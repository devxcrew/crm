import { randomUUID } from "node:crypto";
import { sql, type Kysely } from "kysely";
import { AppError } from "@codexsun/framework/errors";
import type { TechMediaDatabase } from "../../database/schema.js";
import type {
  NotificationContext,
  NotificationEvent,
  NotificationInboxItem,
  NotificationPublisher
} from "./notification.types.js";
import { FirebasePushGateway } from "./firebase-push-gateway.js";
import { env } from "../../env.js";

export function createNotificationPublisher(
  database: Kysely<TechMediaDatabase>
): NotificationPublisher {
  return new DatabaseNotificationPublisher(
    database,
    FirebasePushGateway.fromServiceAccountJson(env.FIREBASE_SERVICE_ACCOUNT_JSON)
  );
}

export class NotificationService {
  constructor(private readonly context: NotificationContext) {}

  async inbox(): Promise<NotificationInboxItem[]> {
    const actor = await this.requireActor();
    const records = await this.context.database
      .selectFrom("notifications")
      .select(["id", "event_type", "title", "body", "resource_id", "created_at"])
      .where("recipient_user_id", "=", actor.id)
      .where("status", "=", "unread")
      .orderBy("created_at", "desc")
      .limit(50)
      .execute();
    return records.map(toInboxItem);
  }

  async markRead(id: number): Promise<NotificationInboxItem> {
    const actor = await this.requireActor();
    const record = await this.context.database
      .selectFrom("notifications")
      .select(["id", "event_type", "title", "body", "resource_id", "created_at"])
      .where("id", "=", id)
      .where("recipient_user_id", "=", actor.id)
      .executeTakeFirst();
    if (!record) throw AppError.notFound("Notification was not found.");
    await this.context.database
      .updateTable("notifications")
      .set({ read_at: new Date(), status: "read" })
      .where("id", "=", id)
      .execute();
    return toInboxItem(record);
  }

  async registerDevice(token: string): Promise<void> {
    const actor = await this.requireActor();
    await this.context.database
      .insertInto("notification_device_tokens")
      .values({ token, user_id: actor.id, uuid: randomUUID() })
      .onDuplicateKeyUpdate({ updated_at: new Date(), user_id: actor.id })
      .execute();
  }

  private async requireActor() {
    const actor = await this.context.actorUser();
    if (!actor) throw AppError.unauthorized("An active user is required.");
    return actor;
  }
}

class DatabaseNotificationPublisher implements NotificationPublisher {
  constructor(
    private readonly database: Kysely<TechMediaDatabase>,
    private readonly push: FirebasePushGateway
  ) {}

  async enqueue(input: NotificationEvent) {
    const recipientId = await this.recipientId(input);
    if (!recipientId || recipientId === input.actorUserId) return;
    const inserted = await this.database
      .insertInto("notifications")
      .values({
        actor_user_id: input.actorUserId,
        body: input.body.slice(0, 1000),
        event_type: input.type,
        recipient_user_id: recipientId,
        resource_id: input.resourceId,
        title: input.title.slice(0, 220),
        uuid: randomUUID()
      })
      .executeTakeFirstOrThrow();
    const notificationId = Number(inserted.insertId);
    await this.database
      .insertInto("notification_outbox")
      .values({ notification_id: notificationId, uuid: randomUUID() })
      .execute();
    await this.deliver(notificationId, recipientId, input);
  }

  async unreadAssignmentResourceIds(recipientUserId: number): Promise<Set<string>> {
    const records = await this.database
      .selectFrom("notifications")
      .select("resource_id")
      .where("recipient_user_id", "=", recipientUserId)
      .where("event_type", "=", "assignment")
      .where("status", "=", "unread")
      .execute();
    return new Set(records.map((record) => record.resource_id));
  }

  async claimUnreadAssignments(recipientUserId: number, resourceId: string): Promise<number[]> {
    const notifications = await this.database
      .selectFrom("notifications")
      .select("id")
      .where("recipient_user_id", "=", recipientUserId)
      .where("resource_id", "=", resourceId)
      .where("event_type", "=", "assignment")
      .where("status", "=", "unread")
      .execute();
    const claimed: number[] = [];
    for (const notification of notifications) {
      const result = await this.database
        .updateTable("notifications")
        .set({ read_at: new Date(), status: "read" })
        .where("id", "=", notification.id)
        .where("recipient_user_id", "=", recipientUserId)
        .where("status", "=", "unread")
        .executeTakeFirst();
      if (Number(result.numUpdatedRows) > 0) claimed.push(notification.id);
    }
    return claimed;
  }

  async restoreUnreadAssignments(
    recipientUserId: number,
    notificationIds: number[]
  ): Promise<void> {
    if (!notificationIds.length) return;
    await this.database
      .updateTable("notifications")
      .set({ read_at: null, status: "unread" })
      .where("id", "in", notificationIds)
      .where("recipient_user_id", "=", recipientUserId)
      .where("event_type", "=", "assignment")
      .execute();
  }

  private async recipientId(input: NotificationEvent): Promise<number | undefined> {
    if (input.recipientUserId) return input.recipientUserId;
    if (!input.recipientEmployeeCode?.trim()) return undefined;
    const recipient = await this.database
      .selectFrom("users")
      .select("id")
      .where("frappe_employee_code", "=", input.recipientEmployeeCode.trim())
      .where("status", "=", "active")
      .executeTakeFirst();
    return recipient?.id;
  }

  private async deliver(
    notificationId: number,
    recipientId: number,
    input: NotificationEvent
  ): Promise<void> {
    if (!this.push.isConfigured) return;
    const tokens = await this.database
      .selectFrom("notification_device_tokens")
      .select("token")
      .where("user_id", "=", recipientId)
      .execute();
    if (!tokens.length) return;

    try {
      const result = await this.push.send(
        tokens.map((record) => record.token),
        {
          body: input.body.slice(0, 1000),
          data: {
            notificationId: String(notificationId),
            resourceId: input.resourceId,
            type: input.type
          },
          title: input.title.slice(0, 220)
        }
      );
      if (result.invalidTokens.length) {
        await this.database
          .deleteFrom("notification_device_tokens")
          .where("token", "in", result.invalidTokens)
          .execute();
      }
      if (result.sent) await this.markDelivered(notificationId);
    } catch (error) {
      console.warn(
        "[notifications.fcm] delivery failed",
        error instanceof Error ? error.message : "unknown error"
      );
      await this.markDeliveryAttempt(notificationId);
    }
  }

  private async markDelivered(notificationId: number): Promise<void> {
    await this.database
      .updateTable("notification_outbox")
      .set({ attempts: sql`attempts + 1`, delivered_at: new Date(), status: "delivered" })
      .where("notification_id", "=", notificationId)
      .execute();
  }

  private async markDeliveryAttempt(notificationId: number): Promise<void> {
    await this.database
      .updateTable("notification_outbox")
      .set({ attempts: sql`attempts + 1` })
      .where("notification_id", "=", notificationId)
      .execute();
  }
}

function toInboxItem(record: {
  body: string;
  created_at: Date;
  event_type: string;
  id: number;
  resource_id: string;
  title: string;
}): NotificationInboxItem {
  return {
    body: record.body,
    createdAt: record.created_at.toISOString(),
    id: record.id,
    resourceId: record.resource_id,
    title: record.title,
    type: record.event_type as NotificationInboxItem["type"]
  };
}
