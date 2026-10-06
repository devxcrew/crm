import type {
  ConversationMemberDto,
  ConversationDto,
  MessageDto
} from "./messaging.types.js";
import type {
  ConversationMemberRow,
  ConversationRow,
  MessageRow,
  UserReferenceRow
} from "./messaging.repositories.js";

export function toConversationDto(
  row: ConversationRow,
  members: ConversationMemberRow[],
  users: UserReferenceRow[] = []
): ConversationDto {
  const usersById = new Map(users.map((user) => [user.id, user]));
  return {
    avatar: row.avatar,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    id: row.id,
    lastMessageId: row.last_message_id,
    lastMessage: null,
    lastMessageSequence: row.last_message_sequence,
    members: members.map((member) => toMemberDto(member, usersById.get(member.user_id))),
    metadata: parseJson(row.metadata_json),
    status: row.status,
    title: row.title,
    type: row.type,
    updatedAt: row.updated_at.toISOString(),
    unreadCount: 0,
    uuid: row.uuid
  };
}

export function toMemberDto(
  row: ConversationMemberRow,
  user?: UserReferenceRow
): ConversationMemberDto {
  return {
    conversationId: row.conversation_id,
    email: user?.email ?? "",
    joinedAt: row.joined_at.toISOString(),
    lastReadMessageId: row.last_read_message_id,
    notificationLevel: row.notification_level,
    role: row.role,
    userId: row.user_id,
    userName: user?.name ?? `User ${row.user_id}`
  };
}

export function toMessageDto(
  row: MessageRow,
  sender?: UserReferenceRow,
  receipt = { deliveredCount: 0, readCount: 0, recipientCount: 0 },
  reactions: Array<{ emoji: string; userId: number; userName: string }> = []
): MessageDto {
  const fallbackEmail = `${row.sender_id}@members.local`;
  return {
    clientMessageId: row.client_message_id,
    content: row.content,
    conversationId: row.conversation_id,
    createdAt: row.created_at.toISOString(),
    deletedAt: row.deleted_at ? row.deleted_at.toISOString() : null,
    editedAt: row.edited_at ? row.edited_at.toISOString() : null,
    forwardedFromMessageId: row.forwarded_from_message_id,
    id: row.id,
    metadata: parseJson(row.metadata_json),
    replyToMessageId: row.reply_to_message_id,
    senderEmail: sender?.email ?? fallbackEmail,
    senderId: row.sender_id,
    senderName: sender?.name ?? `User ${row.sender_id}`,
    sequenceNumber: row.sequence_number,
    status: receipt.recipientCount > 0 && receipt.readCount === receipt.recipientCount
      ? "READ"
      : receipt.recipientCount > 0 && receipt.deliveredCount === receipt.recipientCount
        ? "DELIVERED"
        : row.status,
    threadId: row.thread_id,
    type: row.type,
    updatedAt: row.updated_at.toISOString(),
    uuid: row.uuid,
    receipt,
    reactions
  };
}

export function parseJson(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}
