import { AppError } from "@codexsun/framework/errors";
import { recordAuditEvent } from "../../database/audit.js";
import { toMessageDto } from "./messaging.mapper.js";
import type { MessageDto, MessagingContext } from "./messaging.types.js";
import type { MessagingRepository, MessageRow } from "./messaging.repositories.js";
import type { MessageStatus, MessageType } from "../../database/schema.js";
import type { MessageMediaStorage } from "./message-media-storage.js";

export type SendMessageInput = {
  clientMessageId: string | null;
  content: string;
  forwardedFromMessageId?: number | null | undefined;
  metadata?: Record<string, unknown> | undefined;
  replyToMessageId?: number | null | undefined;
  threadId?: number | null | undefined;
  type: MessageType;
};

export class MessageService {
  constructor(
    private readonly context: MessagingContext,
    private readonly repository: MessagingRepository,
    private readonly media?: MessageMediaStorage
  ) {}

  /** Persists a message idempotently by client_message_id. The database write
   * completes before the message is considered sent. */
  async send(conversationId: number, input: SendMessageInput): Promise<MessageDto> {
    const actor = await this.requireActor();
    const conversation = await this.repository.findConversationByMember(conversationId, actor.id);
    if (!conversation) throw AppError.notFound("Conversation was not found.");
    if (input.clientMessageId) {
      const existing = await this.repository.findMessageByClientId(
        conversationId,
        input.clientMessageId
      );
      if (existing) return this.withDetails([existing]).then(([message]) => message!);
    }
    const metadata = await this.persistAttachment(conversationId, input.metadata ?? {});
    const row = await this.repository.saveMessage({
      client_message_id: input.clientMessageId,
      content: input.content,
      conversation_id: conversationId,
      forwarded_from_message_id: input.forwardedFromMessageId ?? null,
      metadata,
      reply_to_message_id: input.replyToMessageId ?? null,
      sender_id: actor.id,
      thread_id: input.threadId ?? null,
      type: input.type
    });
    await recordAuditEvent({
      action: "message.created",
      actorEmail: actor.email,
      moduleKey: "messaging",
      recordId: row.id,
      recordLabel: `conversation:${conversationId}`,
      recordUuid: row.uuid
    });
    const members = await this.repository.listMembers(conversationId);
    await this.repository.saveMessageReceipts(row.id, members.filter((member) => member.user_id !== actor.id).map((member) => member.user_id));
    return this.withDetails([row]).then(([message]) => message!);
  }

  async list(
    conversationId: number,
    options: { beforeSequence?: number; limit: number }
  ): Promise<MessageDto[]> {
    const actor = await this.requireActor();
    const conversation = await this.repository.findConversationByMember(conversationId, actor.id);
    if (!conversation) throw AppError.notFound("Conversation was not found.");
    const rows = await this.repository.listMessages(conversationId, options);
    return this.withDetails(rows);
  }

  /** Offline synchronization: return messages after the last known sequence. */
  async afterSequence(
    conversationId: number,
    afterSequence: number,
    limit: number
  ): Promise<MessageDto[]> {
    const actor = await this.requireActor();
    const conversation = await this.repository.findConversationByMember(conversationId, actor.id);
    if (!conversation) throw AppError.notFound("Conversation was not found.");
    const rows = await this.repository.messagesAfterSequence(conversationId, afterSequence, limit);
    return this.withDetails(rows);
  }

  /** Advances delivery/read state for a single message in a conversation. */
  async setStatus(
    conversationId: number,
    messageId: number,
    status: MessageStatus
  ): Promise<number> {
    const actor = await this.requireActor();
    const conversation = await this.repository.findConversationByMember(conversationId, actor.id);
    if (!conversation) throw AppError.notFound("Conversation was not found.");
    const message = await this.repository.findMessageById(messageId);
    if (!message || message.conversation_id !== conversationId) {
      throw AppError.notFound("Message was not found.");
    }
    await this.repository.setMessageStatus(messageId, status);
    return message.sequence_number;
  }

  async markRead(conversationId: number, messageId: number): Promise<{ message: MessageDto; updated: MessageDto[] }> {
    const actor = await this.requireActor();
    const member = await this.repository.findMember(conversationId, actor.id);
    if (!member) throw AppError.notFound("Conversation was not found.");
    const message = await this.repository.findMessageById(messageId);
    if (!message || message.conversation_id !== conversationId) throw AppError.notFound("Message was not found.");
    const previous = member.last_read_message_id ? await this.repository.findMessageById(member.last_read_message_id) : undefined;
    if (!previous || previous.sequence_number < message.sequence_number) {
      await this.repository.markConversationRead(conversationId, actor.id, messageId);
    }
    const updatedRows = await this.repository.markMessagesReadThrough(
      conversationId,
      actor.id,
      message.sequence_number
    );
    const updated = await this.withDetails(updatedRows);
    return { message: updated.find((item) => item.id === message.id)!, updated };
  }

  async react(conversationId: number, messageId: number, emoji: string | null): Promise<MessageDto> {
    const actor = await this.requireActor();
    const conversation = await this.repository.findConversationByMember(conversationId, actor.id);
    const message = await this.repository.findMessageById(messageId);
    if (!conversation || !message || message.conversation_id !== conversationId) throw AppError.notFound("Message was not found.");
    if (emoji) await this.repository.setMessageReaction(messageId, actor.id, emoji);
    else await this.repository.removeMessageReaction(messageId, actor.id);
    return this.withDetails([message]).then(([item]) => item!);
  }

  private async withDetails(rows: MessageRow[]): Promise<MessageDto[]> {
    const senderIds = [...new Set(rows.map((row) => row.sender_id))];
    const users = await this.repository.findUsersByIds(senderIds);
    const byId = new Map(users.map((user) => [user.id, user]));
    const summaries = await this.repository.listMessageReceiptSummaries(rows.map((row) => row.id));
    const summaryByMessage = new Map(summaries.map((summary) => [summary.messageId, summary]));
    const reactionRows = await this.repository.listMessageReactions(rows.map((row) => row.id));
    const reactions = new Map<number, Array<{ emoji: string; userId: number; userName: string }>>();
    for (const reaction of reactionRows) {
      const items = reactions.get(reaction.message_id) ?? [];
      items.push({ emoji: reaction.emoji, userId: reaction.user_id, userName: reaction.user_name });
      reactions.set(reaction.message_id, items);
    }
    return rows.map((row) => {
      const summary = summaryByMessage.get(row.id);
      return toMessageDto(row, byId.get(row.sender_id), summary ?? { deliveredCount: 0, readCount: 0, recipientCount: 0 }, reactions.get(row.id) ?? []);
    });
  }

  private async persistAttachment(conversationId: number, metadata: Record<string, unknown>) {
    const raw = metadata.attachment;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return metadata;
    const attachment = raw as Record<string, unknown>;
    if (typeof attachment.dataUrl !== "string" || typeof attachment.name !== "string" || typeof attachment.type !== "string") return metadata;
    if (!this.media) throw AppError.conflict("Message media storage is not configured.");
    const stored = await this.media.store(conversationId, { dataUrl: attachment.dataUrl, name: attachment.name, type: attachment.type });
    return {
      ...metadata,
      attachment: {
        contentType: stored.contentType,
        key: stored.key,
        name: stored.name,
        size: stored.size,
        url: `/messaging/conversations/${conversationId}/media/${stored.key}`
      }
    };
  }

  private async requireActor() {
    const actor = await this.context.actorUser();
    if (!actor) throw AppError.unauthorized("An active user is required.");
    return actor;
  }
}
