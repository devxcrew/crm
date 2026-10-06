import type { FastifyRequest } from "fastify";
import { z } from "zod";
import { identityContext } from "../../auth/identity-context.js";
import type {
  ConversationMemberRole,
  ConversationStatus,
  ConversationType,
  MessageStatus,
  MessageType
} from "../../database/schema.js";

export type MessagingActor = {
  email: string;
  id: number;
  name: string;
  uuid: string;
};

export type MessagingContext = {
  actorUser: () => Promise<MessagingActor | undefined>;
  authorize: (permission: string) => Promise<void>;
};

export function messagingContext(request: FastifyRequest): MessagingContext {
  const context = identityContext(request);
  return {
    actorUser: async () => {
      const user = await context.actorUser();
      return user
        ? { email: user.email, id: user.id, name: user.name, uuid: user.uuid }
        : undefined;
    },
    authorize: context.authorize
  };
}

export const conversationTypeValues: readonly ConversationType[] = [
  "DIRECT",
  "GROUP",
  "TEAM",
  "PROJECT",
  "CUSTOMER",
  "SUPPORT",
  "SYSTEM"
];
export const messageTypeValues: readonly MessageType[] = [
  "TEXT",
  "IMAGE",
  "VIDEO",
  "AUDIO",
  "VOICE",
  "DOCUMENT",
  "FILE",
  "SYSTEM",
  "TASK",
  "ORDER",
  "INVOICE",
  "AGENT",
  "CONTACT",
  "LOCATION"
];
export const messageStatusValues: readonly MessageStatus[] = [
  "SENDING",
  "SENT",
  "DELIVERED",
  "READ",
  "FAILED"
];

export type ConversationMemberDto = {
  conversationId: number;
  email: string;
  joinedAt: string;
  lastReadMessageId: number | null;
  notificationLevel: "all" | "mentions" | "muted";
  role: ConversationMemberRole;
  userId: number;
  userName: string;
};

export type ConversationDto = {
  avatar: string | null;
  createdBy: number;
  createdAt: string;
  id: number;
  lastMessageId: number | null;
  lastMessageSequence: number;
  lastMessage: MessageDto | null;
  members: ConversationMemberDto[];
  metadata: Record<string, unknown>;
  status: ConversationStatus;
  title: string | null;
  type: ConversationType;
  updatedAt: string;
  uuid: string;
  unreadCount: number;
};

export type MessageDto = {
  clientMessageId: string | null;
  content: string;
  conversationId: number;
  createdAt: string;
  deletedAt: string | null;
  editedAt: string | null;
  forwardedFromMessageId: number | null;
  id: number;
  metadata: Record<string, unknown>;
  replyToMessageId: number | null;
  senderEmail: string;
  senderId: number;
  senderName: string;
  sequenceNumber: number;
  status: MessageStatus;
  threadId: number | null;
  type: MessageType;
  updatedAt: string;
  uuid: string;
  receipt: { deliveredCount: number; readCount: number; recipientCount: number };
  reactions: Array<{ emoji: string; userId: number; userName: string }>;
};

/** Strongly typed envelope shared by every client and server realtime frame. */
export type RealtimeEnvelope<TPayload = Record<string, unknown>> = {
  eventId: string;
  eventType: string;
  payload: TPayload;
  timestamp?: string;
};

export const clientEventTypes = [
  "auth",
  "heartbeat",
  "conversation.subscribe",
  "conversation.unsubscribe",
  "message.send",
  "message.delivered",
  "message.read",
  "typing.start",
  "typing.stop",
  "presence.subscribe",
  "sync.request",
  "reaction.add",
  "reaction.remove"
] as const;
export type ClientEventType = (typeof clientEventTypes)[number];

export const serverEventTypes = [
  "auth.success",
  "auth.failed",
  "conversation.updated",
  "message.created",
  "message.updated",
  "message.deleted",
  "message.delivered",
  "message.read",
  "typing.started",
  "typing.stopped",
  "presence.updated",
  "reaction.created",
  "reaction.deleted",
  "sync.started",
  "sync.completed",
  "sync.required",
  "notification.created",
  "error"
] as const;
export type ServerEventType = (typeof serverEventTypes)[number];

export const realtimeEnvelopeSchema = z.object({
  eventId: z.string().trim().min(1).max(80),
  eventType: z.string().trim().min(1).max(80),
  payload: z.record(z.string(), z.unknown())
});

export const authPayloadSchema = z.object({ token: z.string().trim().min(1) });
export const conversationRefPayloadSchema = z.object({
  conversationId: z.coerce.number().int().positive()
});
export const sendPayloadSchema = z
  .object({
    clientMessageId: z.string().trim().min(1).max(80),
    content: z.string().trim().min(1).max(10_000),
    conversationId: z.coerce.number().int().positive(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    replyToMessageId: z.number().int().positive().nullish(),
    type: z.enum(messageTypeValues)
  })
  .strict();
export const syncPayloadSchema = z
  .object({
    afterSequence: z.coerce.number().int().nonnegative().default(0),
    conversationId: z.coerce.number().int().positive(),
    limit: z.coerce.number().int().positive().max(200).default(200)
  })
  .strict();

export const messageDtoSchema = z.object({
  clientMessageId: z.string().nullable(),
  content: z.string(),
  conversationId: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().nullable(),
  editedAt: z.iso.datetime().nullable(),
  forwardedFromMessageId: z.number().int().positive().nullable(),
  id: z.number().int().positive(),
  metadata: z.record(z.string(), z.unknown()),
  replyToMessageId: z.number().int().positive().nullable(),
  senderEmail: z.string(),
  senderId: z.number().int().positive(),
  senderName: z.string(),
  sequenceNumber: z.number().int().nonnegative(),
  status: z.enum(messageStatusValues),
  threadId: z.number().int().positive().nullable(),
  type: z.enum(messageTypeValues),
  updatedAt: z.iso.datetime(),
  uuid: z.string()
  ,receipt: z.object({ deliveredCount: z.number().int().nonnegative(), readCount: z.number().int().nonnegative(), recipientCount: z.number().int().nonnegative() })
  ,reactions: z.array(z.object({ emoji: z.string(), userId: z.number().int().positive(), userName: z.string() }))
});
