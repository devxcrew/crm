import { randomUUID } from "node:crypto";
import { AppError } from "@codexsun/framework/errors";
import type { ConnectionManager, RealtimeConnection } from "./connection-manager.js";
import { MessageService } from "./message.service.js";
import type { MessageMediaStorage } from "./message-media-storage.js";
import type { RealtimeBus } from "./realtime-bus.js";
import type { MessagingRepository } from "./messaging.repositories.js";
import type { MessagingActor, MessagingContext } from "./messaging.types.js";
import {
  authPayloadSchema,
  conversationRefPayloadSchema,
  realtimeEnvelopeSchema,
  sendPayloadSchema,
  syncPayloadSchema,
  type RealtimeEnvelope
} from "./messaging.types.js";

export type RealtimeGatewayDependencies = {
  actorFromToken: (token: string) => Promise<MessagingActor | undefined>;
  bus: RealtimeBus;
  manager: ConnectionManager;
  media?: MessageMediaStorage;
  repository: MessagingRepository;
};

/**
 * Transport-agnostic realtime boundary. It owns protocol routing, authentication
 * of the socket, subscriptions, and fan-out, but all business work (persistence,
 * access checks, sequence allocation) is delegated to services. The WebSocket
 * adapter only moves frames in and out.
 */
export class RealtimeGateway {
  constructor(private readonly deps: RealtimeGatewayDependencies) {}

  async handle(connectionId: string, raw: string): Promise<void> {
    const parsed = realtimeEnvelopeSchema.safeParse(parseFrame(raw));
    if (!parsed.success) {
      this.send(connectionId, "error", { code: "INVALID_EVENT", message: "Malformed event." });
      return;
    }
    const envelope = parsed.data;
    switch (envelope.eventType) {
      case "auth":
        await this.authenticate(connectionId, envelope);
        return;
      case "heartbeat":
        return;
      case "conversation.subscribe":
        await this.subscribe(connectionId, envelope, true);
        return;
      case "conversation.unsubscribe":
        await this.subscribe(connectionId, envelope, false);
        return;
      case "message.send":
        await this.sendMessage(connectionId, envelope);
        return;
      case "sync.request":
        await this.sync(connectionId, envelope);
        return;
      default:
        this.send(connectionId, "error", {
          code: "UNSUPPORTED_EVENT",
          message: `Unsupported event type: ${envelope.eventType}.`
        });
    }
  }

  private async authenticate(connectionId: string, envelope: RealtimeEnvelope) {
    const payload = authPayloadSchema.safeParse(envelope.payload);
    if (!payload.success) {
      this.send(connectionId, "auth.failed", { reason: "INVALID_AUTH" });
      return;
    }
    const actor = await this.deps.actorFromToken(payload.data.token);
    const connection = this.deps.manager.get(connectionId);
    if (!actor || !connection) {
      this.send(connectionId, "auth.failed", { reason: "UNAUTHORIZED" });
      return;
    }
    connection.userEmail = actor.email;
    connection.userId = actor.id;
    connection.userName = actor.name;
    connection.userUuid = actor.uuid;
    this.deps.manager.add(connection);
    this.send(connectionId, "auth.success", { name: actor.name, userId: actor.id });
  }

  private async subscribe(
    connectionId: string,
    envelope: RealtimeEnvelope,
    subscribe: boolean
  ) {
    if (!this.authenticated(connectionId)) return this.rejectUnauthenticated(connectionId);
    const payload = conversationRefPayloadSchema.safeParse(envelope.payload);
    if (!payload.success) {
      this.send(connectionId, "error", { code: "INVALID_PAYLOAD", message: "Invalid conversation." });
      return;
    }
    if (subscribe) this.deps.manager.subscribe(connectionId, payload.data.conversationId);
    else this.deps.manager.unsubscribe(connectionId, payload.data.conversationId);
  }

  private async sendMessage(connectionId: string, envelope: RealtimeEnvelope) {
    if (!this.authenticated(connectionId)) return this.rejectUnauthenticated(connectionId);
    const payload = sendPayloadSchema.safeParse(envelope.payload);
    if (!payload.success) {
      this.send(connectionId, "error", { code: "INVALID_PAYLOAD", message: "Invalid message." });
      return;
    }
    const connection = this.deps.manager.get(connectionId)!;
    const { clientMessageId, content, conversationId, metadata, replyToMessageId, type } = payload.data;
    try {
      const service = this.service(connection);
      const message = await service.send(conversationId, {
        clientMessageId,
        content,
        ...(metadata !== undefined ? { metadata } : {}),
        ...(replyToMessageId !== undefined ? { replyToMessageId } : {}),
        type
      });
      const memberIds = await this.memberIds(conversationId);
      this.deps.bus.publishToConversation(
        memberIds,
        conversationId,
        realtimeFrame("message.created", { conversationId, message })
      );
    } catch (error) {
      this.send(connectionId, "error", {
        code: error instanceof AppError ? error.code : "MESSAGE_SEND_FAILED",
        message: error instanceof AppError ? error.message : "Message could not be sent."
      });
    }
  }

  private async sync(connectionId: string, envelope: RealtimeEnvelope) {
    if (!this.authenticated(connectionId)) return this.rejectUnauthenticated(connectionId);
    const payload = syncPayloadSchema.safeParse(envelope.payload);
    if (!payload.success) {
      this.send(connectionId, "error", { code: "INVALID_PAYLOAD", message: "Invalid sync request." });
      return;
    }
    const connection = this.deps.manager.get(connectionId)!;
    this.send(connectionId, "sync.started", { conversationId: payload.data.conversationId });
    try {
      const messages = await this.service(connection).afterSequence(
        payload.data.conversationId,
        payload.data.afterSequence,
        payload.data.limit
      );
      const last = messages[messages.length - 1];
      this.send(connectionId, "sync.completed", {
        conversationId: payload.data.conversationId,
        latestSequence: last ? last.sequenceNumber : payload.data.afterSequence,
        messages
      });
    } catch (error) {
      this.send(connectionId, "error", {
        code: error instanceof AppError ? error.code : "SYNC_FAILED",
        message: error instanceof AppError ? error.message : "Synchronization failed."
      });
    }
  }

  private service(connection: RealtimeConnection): MessageService {
    const context: MessagingContext = {
      actorUser: async () => ({
        email: connection.userEmail,
        id: connection.userId,
        name: connection.userName,
        uuid: connection.userUuid
      }),
      authorize: async () => {}
    };
    return new MessageService(context, this.deps.repository, this.deps.media);
  }

  private async memberIds(conversationId: number): Promise<number[]> {
    const members = await this.deps.repository.listMembers(conversationId);
    return members.map((member) => member.user_id);
  }

  private authenticated(connectionId: string) {
    const connection = this.deps.manager.get(connectionId);
    return connection ? connection.userId > 0 : false;
  }

  private rejectUnauthenticated(connectionId: string) {
    this.send(connectionId, "error", {
      code: "UNAUTHENTICATED",
      message: "Authenticate before sending realtime events."
    });
  }

  private send(connectionId: string, eventType: string, payload: Record<string, unknown>) {
    this.deps.manager.get(connectionId)?.socket.send(realtimeFrame(eventType, payload));
  }
}

export function realtimeFrame(eventType: string, payload: Record<string, unknown>): string {
  return JSON.stringify({
    eventId: randomUUID(),
    eventType,
    payload,
    timestamp: new Date().toISOString()
  });
}

function parseFrame(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}
