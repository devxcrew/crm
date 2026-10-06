import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "@codexsun/framework/errors";
import { registerContractRoute } from "@codexsun/framework/http";
import { ConversationService } from "./conversation.service.js";
import { MessageService } from "./message.service.js";
import { messageDtoSchema, messagingContext, messageTypeValues } from "./messaging.types.js";
import type { MessagingRepository } from "./messaging.repositories.js";
import type { RealtimeBus } from "./realtime-bus.js";
import { realtimeFrame } from "./realtime-gateway.js";
import type { MessageMediaStorage } from "./message-media-storage.js";
import type { NotificationPublisher } from "../notification/notification.types.js";

const memberRecord = z.object({
  conversationId: z.number().int().positive(),
  email: z.string(),
  joinedAt: z.iso.datetime(),
  lastReadMessageId: z.number().int().positive().nullable(),
  notificationLevel: z.enum(["all", "mentions", "muted"]),
  role: z.enum(["ADMIN", "MEMBER", "OWNER", "VIEWER"]),
  userId: z.number().int().positive(),
  userName: z.string()
});
const conversationRecord = z.object({
  avatar: z.string().nullable(),
  createdBy: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  id: z.number().int().positive(),
  lastMessageId: z.number().int().positive().nullable(),
  lastMessage: messageDtoSchema.nullable(),
  lastMessageSequence: z.number().int().nonnegative(),
  members: z.array(memberRecord),
  metadata: z.record(z.string(), z.unknown()),
  status: z.enum(["active", "archived", "deleted"]),
  title: z.string().nullable(),
  type: z.enum(["DIRECT", "GROUP", "TEAM", "PROJECT", "CUSTOMER", "SUPPORT", "SYSTEM"]),
  updatedAt: z.iso.datetime(),
  uuid: z.string(),
  unreadCount: z.number().int().nonnegative()
});
const params = z.object({ id: z.coerce.number().int().positive() });
const contactsQuery = z.object({ search: z.string().trim().max(180).default("") });
const contactRecord = z.object({
  email: z.string().email(),
  id: z.number().int().positive(),
  name: z.string()
});
const createBody = z
  .object({
    memberIds: z.array(z.number().int().positive()),
    metadata: z.record(z.string(), z.unknown()).optional(),
    title: z.string().trim().max(180).nullable().optional(),
    type: z.enum(["DIRECT", "GROUP", "TEAM", "PROJECT", "CUSTOMER", "SUPPORT", "SYSTEM"])
  })
  .strict();
const addMemberBody = z
  .object({
    role: z.enum(["ADMIN", "MEMBER", "OWNER", "VIEWER"]),
    userId: z.number().int().positive()
  })
  .strict();
const messagesQuery = z.object({
  beforeSequence: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50)
});
const sendBody = z
  .object({
    clientMessageId: z.string().trim().min(1).max(80),
    content: z.string().trim().min(1).max(10_000),
    metadata: z.record(z.string(), z.unknown()).optional(),
    replyToMessageId: z.number().int().positive().nullable().optional(),
    type: z.enum(messageTypeValues)
  })
  .strict();
const readBody = z.object({ messageId: z.number().int().positive() }).strict();
const reactionBody = z.object({ emoji: z.string().trim().min(1).max(32).nullable() }).strict();
const messageParams = z.object({
  id: z.coerce.number().int().positive(),
  messageId: z.coerce.number().int().positive()
});

export function registerMessagingRoutes(
  app: FastifyInstance,
  repository: MessagingRepository,
  bus: RealtimeBus,
  media: MessageMediaStorage,
  notificationPublisher: NotificationPublisher
): void {
  registerContractRoute(app, {
    method: "GET",
    url: "/messaging/contacts",
    schemas: { querystring: contactsQuery, response: z.array(contactRecord) },
    handler: ({ query, request }) =>
      new ConversationService(messagingContext(request), repository).listContacts(query.search)
  });
  registerContractRoute(app, {
    method: "POST",
    url: "/messaging/conversations/:id/read",
    schemas: {
      body: readBody,
      params,
      response: z.object({ messageId: z.number().int().positive() })
    },
    handler: async ({ body, params, request }) => {
      const service = new MessageService(messagingContext(request), repository);
      const result = await service.markRead(params.id, body.messageId);
      const actor = await messagingContext(request).actorUser();
      const members = await repository.listMembers(params.id);
      if (actor) {
        for (const message of result.updated) {
          bus.publishToConversation(
            members.map((member) => member.user_id),
            params.id,
            realtimeFrame("message.updated", {
              conversationId: params.id,
              message,
              userId: actor.id
            })
          );
        }
      }
      return { messageId: body.messageId };
    }
  });
  registerContractRoute(app, {
    method: "POST",
    url: "/messaging/conversations/:id/messages/:messageId/reaction",
    schemas: { body: reactionBody, params: messageParams, response: messageDtoSchema },
    handler: async ({ body, params, request }) => {
      const message = await new MessageService(messagingContext(request), repository).react(
        params.id,
        params.messageId,
        body.emoji
      );
      const members = await repository.listMembers(params.id);
      bus.publishToConversation(
        members.map((member) => member.user_id),
        params.id,
        realtimeFrame(body.emoji ? "reaction.created" : "reaction.deleted", {
          conversationId: params.id,
          message
        })
      );
      return message;
    }
  });
  registerContractRoute(app, {
    method: "GET",
    url: "/messaging/conversations",
    schemas: { response: z.array(conversationRecord) },
    handler: ({ request }) => new ConversationService(messagingContext(request), repository).list()
  });
  registerContractRoute(app, {
    method: "POST",
    url: "/messaging/conversations",
    schemas: { body: createBody, response: conversationRecord },
    handler: ({ body, request }) =>
      new ConversationService(messagingContext(request), repository).create(body)
  });
  registerContractRoute(app, {
    method: "GET",
    url: "/messaging/conversations/:id",
    schemas: { params, response: conversationRecord },
    handler: async ({ params, request }) =>
      new ConversationService(messagingContext(request), repository).get(params.id)
  });
  registerContractRoute(app, {
    method: "POST",
    url: "/messaging/conversations/:id/members",
    schemas: { body: addMemberBody, params, response: memberRecord },
    handler: ({ body, params, request }) =>
      new ConversationService(messagingContext(request), repository).addMember(
        params.id,
        body.userId,
        body.role
      )
  });
  registerContractRoute(app, {
    method: "GET",
    url: "/messaging/conversations/:id/messages",
    schemas: { params, querystring: messagesQuery, response: z.array(messageDtoSchema) },
    handler: ({ params, query, request }) =>
      new MessageService(messagingContext(request), repository, media).list(params.id, {
        ...(query.beforeSequence !== undefined ? { beforeSequence: query.beforeSequence } : {}),
        limit: query.limit
      })
  });
  registerContractRoute(app, {
    bodyLimit: 14 * 1024 * 1024,
    method: "POST",
    url: "/messaging/conversations/:id/messages",
    schemas: { body: sendBody, params, response: messageDtoSchema },
    handler: async ({ body, params, request }) => {
      const message = await new MessageService(messagingContext(request), repository, media).send(
        params.id,
        body
      );
      if (!message) throw AppError.internal("Message was not created.");
      const members = await repository.listMembers(params.id);
      bus.publishToConversation(
        members.map((member) => member.user_id),
        params.id,
        realtimeFrame("message.created", { conversationId: params.id, message })
      );
      const actor = await messagingContext(request).actorUser();
      if (actor) {
        await Promise.all(
          members.map((member) =>
            notificationPublisher.enqueue({
              actorUserId: actor.id,
              body: message.content,
              recipientUserId: member.user_id,
              resourceId: `conversation:${params.id}`,
              title: `New message from ${actor.name}`,
              type: "chat"
            })
          )
        );
      }
      return message;
    }
  });
  app.get("/messaging/conversations/:id/media/:key", async (request, reply) => {
    const parsed = z
      .object({ id: z.coerce.number().int().positive(), key: z.string().trim().min(1).max(60) })
      .safeParse(request.params);
    if (!parsed.success) throw AppError.notFound("Attachment was not found.");
    const actor = await messagingContext(request).actorUser();
    if (!actor || !(await repository.findConversationByMember(parsed.data.id, actor.id)))
      throw AppError.notFound("Attachment was not found.");
    const bytes = await media.read(parsed.data.id, parsed.data.key);
    if (!bytes) throw AppError.notFound("Attachment was not found.");
    const message = (
      await new MessageService(messagingContext(request), repository, media).list(parsed.data.id, {
        limit: 100_000
      })
    ).find((item) => attachmentKey(item.metadata) === parsed.data.key);
    if (!message) throw AppError.notFound("Attachment was not found.");
    const query = request.query as { download?: string };
    reply.header(
      "content-disposition",
      `${query.download === "1" ? "attachment" : "inline"}; filename="${safeFileName(message.metadata.attachment)}"`
    );
    reply.type(attachmentType(message.metadata.attachment));
    return reply.send(bytes);
  });
}

function attachmentKey(value: Record<string, unknown>) {
  const attachment = value.attachment;
  return attachment &&
    typeof attachment === "object" &&
    !Array.isArray(attachment) &&
    typeof (attachment as Record<string, unknown>).key === "string"
    ? (attachment as Record<string, unknown>).key
    : "";
}
function attachmentType(value: unknown) {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).contentType === "string"
    ? ((value as Record<string, unknown>).contentType as string)
    : "application/octet-stream";
}
function safeFileName(value: unknown) {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).name === "string"
    ? String((value as Record<string, unknown>).name).replace(/"/gu, "_")
    : "attachment";
}
