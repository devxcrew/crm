export type ConversationMemberRole = "ADMIN" | "MEMBER" | "OWNER" | "VIEWER";
export type ConversationStatus = "active" | "archived" | "deleted";
export type ConversationType =
  | "DIRECT"
  | "GROUP"
  | "TEAM"
  | "PROJECT"
  | "CUSTOMER"
  | "SUPPORT"
  | "SYSTEM";
export type MessageStatus = "SENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED";
export type MessageType =
  | "TEXT"
  | "IMAGE"
  | "VIDEO"
  | "AUDIO"
  | "VOICE"
  | "DOCUMENT"
  | "FILE"
  | "SYSTEM"
  | "TASK"
  | "ORDER"
  | "INVOICE"
  | "AGENT"
  | "CONTACT"
  | "LOCATION";

export type ConversationMember = {
  conversationId: number;
  email: string;
  joinedAt: string;
  lastReadMessageId: number | null;
  notificationLevel: "all" | "mentions" | "muted";
  role: ConversationMemberRole;
  userId: number;
  userName: string;
};

export type MessagingContact = { email: string; id: number; name: string };

export type Conversation = {
  avatar: string | null;
  createdBy: number;
  createdAt: string;
  id: number;
  lastMessageId: number | null;
  lastMessage: Message | null;
  lastMessageSequence: number;
  members: ConversationMember[];
  metadata: Record<string, unknown>;
  status: ConversationStatus;
  title: string | null;
  type: ConversationType;
  updatedAt: string;
  uuid: string;
  unreadCount: number;
};

export type Message = {
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

export type CreateConversationInput = {
  memberIds: number[];
  metadata?: Record<string, unknown>;
  title?: string | null;
  type: ConversationType;
};

export type SendMessageInput = {
  clientMessageId: string;
  content: string;
  metadata?: Record<string, unknown>;
  replyToMessageId?: number | null;
  type: MessageType;
};
