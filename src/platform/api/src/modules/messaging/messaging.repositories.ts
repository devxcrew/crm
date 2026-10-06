import { randomBytes } from "node:crypto";
import { sql, type Kysely, type Transaction } from "kysely";
import type {
  ConversationMemberRole,
  ConversationStatus,
  ConversationType,
  MessageStatus,
  MessageType,
  TechMediaDatabase
} from "../../database/schema.js";

export type ConversationRow = {
  avatar: string | null;
  created_at: Date;
  created_by: number;
  id: number;
  last_message_id: number | null;
  last_message_sequence: number;
  metadata_json: string;
  status: ConversationStatus;
  title: string | null;
  type: ConversationType;
  updated_at: Date;
  uuid: string;
};

export type ConversationMemberRow = {
  archived: boolean | number;
  conversation_id: number;
  id: number;
  joined_at: Date;
  last_read_message_id: number | null;
  left_at: Date | null;
  muted: boolean | number;
  notification_level: "all" | "mentions" | "muted";
  role: ConversationMemberRole;
  user_id: number;
};

export type MessageRow = {
  client_message_id: string | null;
  content: string;
  conversation_id: number;
  created_at: Date;
  deleted_at: Date | null;
  edited_at: Date | null;
  forwarded_from_message_id: number | null;
  id: number;
  metadata_json: string;
  reply_to_message_id: number | null;
  sender_id: number;
  sequence_number: number;
  status: MessageStatus;
  thread_id: number | null;
  type: MessageType;
  updated_at: Date;
  uuid: string;
};

export type UserReferenceRow = { email: string; id: number; name: string };
export type MessageReceiptSummary = { deliveredCount: number; messageId: number; readCount: number; recipientCount: number };
export type MessageReactionRow = { emoji: string; message_id: number; user_id: number; user_name: string };

export type NewConversationInput = {
  avatar: string | null;
  created_by: number;
  metadata: Record<string, unknown>;
  title: string | null;
  type: ConversationType;
};

export type NewMemberInput = {
  conversation_id: number;
  role: ConversationMemberRole;
  user_id: number;
};

export type NewMessageInput = {
  client_message_id: string | null;
  content: string;
  conversation_id: number;
  forwarded_from_message_id: number | null;
  metadata: Record<string, unknown>;
  reply_to_message_id: number | null;
  sender_id: number;
  thread_id: number | null;
  type: MessageType;
};

/** Persistence boundary for the messaging engine. The database remains the
 * source of truth; realtime state never crosses this interface. */
export interface MessagingRepository {
  addMember(input: NewMemberInput): Promise<ConversationMemberRow>;
  createConversation(input: NewConversationInput): Promise<ConversationRow>;
  findConversation(id: number): Promise<ConversationRow | undefined>;
  findConversationByMember(id: number, userId: number): Promise<ConversationRow | undefined>;
  findMember(conversationId: number, userId: number): Promise<ConversationMemberRow | undefined>;
  findMessageByClientId(
    conversationId: number,
    clientMessageId: string
  ): Promise<MessageRow | undefined>;
  findMessageById(id: number): Promise<MessageRow | undefined>;
  findLastMessage(conversationId: number): Promise<MessageRow | undefined>;
  findUsersByIds(ids: number[]): Promise<UserReferenceRow[]>;
  findUsersForMessaging(search: string, excludeUserId: number, limit: number): Promise<UserReferenceRow[]>;
  listMessageReceiptSummaries(messageIds: number[]): Promise<MessageReceiptSummary[]>;
  listMessageReactions(messageIds: number[]): Promise<MessageReactionRow[]>;
  listConversationsForUser(userId: number): Promise<ConversationRow[]>;
  listMembers(conversationId: number): Promise<ConversationMemberRow[]>;
  listMessages(
    conversationId: number,
    options: { beforeSequence?: number; limit: number }
  ): Promise<MessageRow[]>;
  countUnreadMessages(conversationId: number, userId: number, lastReadMessageId: number | null): Promise<number>;
  markConversationRead(conversationId: number, userId: number, messageId: number): Promise<void>;
  markMessagesReadThrough(
    conversationId: number,
    userId: number,
    sequenceNumber: number
  ): Promise<MessageRow[]>;
  messagesAfterSequence(
    conversationId: number,
    afterSequence: number,
    limit: number
  ): Promise<MessageRow[]>;
  saveMessage(input: NewMessageInput): Promise<MessageRow>;
  saveMessageReceipts(messageId: number, recipientIds: number[]): Promise<void>;
  setMessageStatus(id: number, status: MessageStatus): Promise<void>;
  setMessageReaction(messageId: number, userId: number, emoji: string): Promise<void>;
  removeMessageReaction(messageId: number, userId: number): Promise<void>;
  markMessageDelivered(messageId: number, userId: number): Promise<void>;
  markMessageRead(messageId: number, userId: number): Promise<void>;
}

export class KyselyMessagingRepository implements MessagingRepository {
  constructor(private readonly database: Kysely<TechMediaDatabase>) {}

  async createConversation(input: NewConversationInput) {
    const inserted = await this.database
      .insertInto("conversations")
      .values({
        avatar: input.avatar,
        created_by: input.created_by,
        metadata_json: JSON.stringify(input.metadata),
        title: input.title,
        type: input.type,
        uuid: randomBytes(4).toString("hex")
      })
      .executeTakeFirstOrThrow();
    return this.database
      .selectFrom("conversations")
      .selectAll()
      .where("id", "=", Number(inserted.insertId))
      .executeTakeFirstOrThrow();
  }

  async findConversation(id: number) {
    return this.conversationById(id);
  }

  async findConversationByMember(id: number, userId: number) {
    return this.database
      .selectFrom("conversations as c")
      .innerJoin("conversation_members as m", "m.conversation_id", "c.id")
      .selectAll("c")
      .where("c.id", "=", id)
      .where("m.user_id", "=", userId)
      .where("m.left_at", "is", null)
      .executeTakeFirst();
  }

  async listConversationsForUser(userId: number) {
    return this.database
      .selectFrom("conversations as c")
      .innerJoin("conversation_members as m", "m.conversation_id", "c.id")
      .selectAll("c")
      .where("m.user_id", "=", userId)
      .where("m.left_at", "is", null)
      .where("c.status", "=", "active")
      .orderBy("c.updated_at", "desc")
      .execute();
  }

  async addMember(input: NewMemberInput) {
    await this.database
      .insertInto("conversation_members")
      .values({
        ...input,
        archived: false,
        muted: false,
        notification_level: "all"
      })
      .executeTakeFirstOrThrow();
    const row = await this.memberByConversationUser(input.conversation_id, input.user_id);
    if (!row) throw new Error("Conversation member could not be read after insert.");
    return row;
  }

  async listMembers(conversationId: number) {
    return this.database
      .selectFrom("conversation_members")
      .selectAll()
      .where("conversation_id", "=", conversationId)
      .where("left_at", "is", null)
      .execute();
  }

  async findMember(conversationId: number, userId: number) {
    return this.memberByConversationUser(conversationId, userId);
  }

  async findMessageById(id: number) {
    return this.database
      .selectFrom("messages")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
  }

  async findLastMessage(conversationId: number) {
    return this.database.selectFrom("messages").selectAll().where("conversation_id", "=", conversationId).where("deleted_at", "is", null).orderBy("sequence_number", "desc").executeTakeFirst();
  }

  async countUnreadMessages(conversationId: number, userId: number, lastReadMessageId: number | null) {
    let query = this.database.selectFrom("messages").select(({ fn }) => fn.count<number>("id").as("count")).where("conversation_id", "=", conversationId).where("sender_id", "!=", userId).where("deleted_at", "is", null);
    if (lastReadMessageId !== null) {
      const lastRead = await this.findMessageById(lastReadMessageId);
      if (lastRead?.conversation_id === conversationId) query = query.where("sequence_number", ">", lastRead.sequence_number);
    }
    const row = await query.executeTakeFirst();
    return Number(row?.count ?? 0);
  }

  async markConversationRead(conversationId: number, userId: number, messageId: number) {
    await this.database.updateTable("conversation_members").set({ last_read_message_id: messageId }).where("conversation_id", "=", conversationId).where("user_id", "=", userId).execute();
  }

  async markMessagesReadThrough(conversationId: number, userId: number, sequenceNumber: number) {
    const messages = await this.database
      .selectFrom("messages")
      .selectAll()
      .where("conversation_id", "=", conversationId)
      .where("deleted_at", "is", null)
      .where("sender_id", "!=", userId)
      .where("sequence_number", "<=", sequenceNumber)
      .execute();
    const messageIds = messages.map((message) => message.id);
    if (messageIds.length) {
      await this.database
        .updateTable("message_receipts")
        .set({ delivered_at: new Date(), read_at: new Date() })
        .where("user_id", "=", userId)
        .where("message_id", "in", messageIds)
        .execute();
    }
    return messages;
  }

  async findMessageByClientId(conversationId: number, clientMessageId: string) {
    return this.database
      .selectFrom("messages")
      .selectAll()
      .where("conversation_id", "=", conversationId)
      .where("client_message_id", "=", clientMessageId)
      .executeTakeFirst();
  }

  async listMessages(conversationId: number, options: { beforeSequence?: number; limit: number }) {
    let query = this.database
      .selectFrom("messages")
      .selectAll()
      .where("conversation_id", "=", conversationId);
    if (options.beforeSequence !== undefined) {
      query = query.where("sequence_number", "<=", options.beforeSequence);
    }
    return query.orderBy("sequence_number", "desc").limit(options.limit).execute();
  }

  async messagesAfterSequence(conversationId: number, afterSequence: number, limit: number) {
    return this.database
      .selectFrom("messages")
      .selectAll()
      .where("conversation_id", "=", conversationId)
      .where("sequence_number", ">", afterSequence)
      .where("deleted_at", "is", null)
      .orderBy("sequence_number", "asc")
      .limit(limit)
      .execute();
  }

  async listMessageReceiptSummaries(messageIds: number[]) {
    if (!messageIds.length) return [];
    const rows = await this.database.selectFrom("message_receipts").select(["message_id", "delivered_at", "read_at"]).where("message_id", "in", messageIds).execute();
    return messageIds.map((messageId) => {
      const receipts = rows.filter((row) => row.message_id === messageId);
      return { deliveredCount: receipts.filter((row) => row.delivered_at !== null).length, messageId, readCount: receipts.filter((row) => row.read_at !== null).length, recipientCount: receipts.length };
    });
  }

  async listMessageReactions(messageIds: number[]) {
    if (!messageIds.length) return [];
    return this.database.selectFrom("message_reactions as r").innerJoin("users as u", "u.id", "r.user_id").select(["r.emoji", "r.message_id", "r.user_id", "u.name as user_name"]).where("r.message_id", "in", messageIds).execute();
  }

  async saveMessage(input: NewMessageInput) {
    const created = await this.database.transaction().execute(async (trx) => {
      const counter = await trx
        .updateTable("conversations")
        .set({ last_message_sequence: sql`last_message_sequence + 1` })
        .where("id", "=", input.conversation_id)
        .executeTakeFirstOrThrow();
      if (Number(counter.numUpdatedRows) < 1) {
        throw new Error("Conversation no longer exists for message persistence.");
      }
      const conversation = await trx
        .selectFrom("conversations")
        .select("last_message_sequence")
        .where("id", "=", input.conversation_id)
        .executeTakeFirstOrThrow();
      const sequence = conversation.last_message_sequence;
      const inserted = await trx
        .insertInto("messages")
        .values({
          client_message_id: input.client_message_id,
          content: input.content,
          conversation_id: input.conversation_id,
          forwarded_from_message_id: input.forwarded_from_message_id,
          metadata_json: JSON.stringify(input.metadata),
          reply_to_message_id: input.reply_to_message_id,
          sender_id: input.sender_id,
          sequence_number: sequence,
          thread_id: input.thread_id,
          type: input.type,
          uuid: randomBytes(4).toString("hex")
        })
        .executeTakeFirstOrThrow();
      const messageId = Number(inserted.insertId);
      await trx
        .updateTable("conversations")
        .set({ last_message_id: messageId, last_message_sequence: sequence })
        .where("id", "=", input.conversation_id)
        .execute();
      return this.messageById(trx, messageId);
    });
    if (!created) throw new Error("Message could not be read after insert.");
    return created;
  }

  async setMessageStatus(id: number, status: MessageStatus) {
    await this.database
      .updateTable("messages")
      .set({ status })
      .where("id", "=", id)
      .execute();
  }

  async saveMessageReceipts(messageId: number, recipientIds: number[]) {
    if (!recipientIds.length) return;
    await this.database.insertInto("message_receipts").ignore().values(recipientIds.map((user_id) => ({ message_id: messageId, user_id, delivered_at: null, read_at: null }))).execute();
  }

  async markMessageDelivered(messageId: number, userId: number) { await this.database.updateTable("message_receipts").set({ delivered_at: new Date() }).where("message_id", "=", messageId).where("user_id", "=", userId).where("delivered_at", "is", null).execute(); }
  async markMessageRead(messageId: number, userId: number) { await this.database.updateTable("message_receipts").set({ delivered_at: new Date(), read_at: new Date() }).where("message_id", "=", messageId).where("user_id", "=", userId).execute(); }
  async setMessageReaction(messageId: number, userId: number, emoji: string) { await this.database.insertInto("message_reactions").values({ message_id: messageId, user_id: userId, emoji }).onDuplicateKeyUpdate({ emoji, created_at: new Date() }).execute(); }
  async removeMessageReaction(messageId: number, userId: number) { await this.database.deleteFrom("message_reactions").where("message_id", "=", messageId).where("user_id", "=", userId).execute(); }

  async findUsersByIds(ids: number[]) {
    if (!ids.length) return [];
    return this.database
      .selectFrom("users")
      .select(["email", "id", "name"])
      .where("id", "in", ids)
      .where("status", "=", "active")
      .execute();
  }

  async findUsersForMessaging(search: string, excludeUserId: number, limit: number) {
    let query = this.database
      .selectFrom("users")
      .select(["email", "id", "name"])
      .where("status", "=", "active")
      .where("id", "!=", excludeUserId);
    if (search) {
      const pattern = `%${search}%`;
      query = query.where((expression) =>
        expression.or([expression("name", "like", pattern), expression("email", "like", pattern)])
      );
    }
    return query.orderBy("name", "asc").limit(limit).execute();
  }

  private async conversationById(id: number) {
    return this.database.selectFrom("conversations").selectAll().where("id", "=", id).executeTakeFirst();
  }

  private async memberByConversationUser(conversationId: number, userId: number) {
    return this.database
      .selectFrom("conversation_members")
      .selectAll()
      .where("conversation_id", "=", conversationId)
      .where("user_id", "=", userId)
      .executeTakeFirst();
  }

  private async messageById(database: Kysely<TechMediaDatabase> | Transaction<TechMediaDatabase>, id: number) {
    return database.selectFrom("messages").selectAll().where("id", "=", id).executeTakeFirst();
  }
}

/** Deterministic in-memory persistence for tests. saveMessage is serialized so
 * sequence allocation stays monotonic without a live database. */
export class InMemoryMessagingRepository implements MessagingRepository {
  private conversations: ConversationRow[] = [];
  private members: ConversationMemberRow[] = [];
  private messages: MessageRow[] = [];
  private receipts: Array<{ delivered_at: Date | null; message_id: number; read_at: Date | null; user_id: number }> = [];
  private reactions: MessageReactionRow[] = [];
  private users: UserReferenceRow[] = [];
  private nextConversationId = 1;
  private nextMemberId = 1;
  private nextMessageId = 1;
  private writeQueue: Promise<unknown> = Promise.resolve();

  seedUsers(users: UserReferenceRow[]) {
    this.users = users.map((user) => ({ ...user }));
    return this;
  }

  get conversationCount() {
    return this.conversations.length;
  }

  get messageCount() {
    return this.messages.length;
  }

  async createConversation(input: NewConversationInput) {
    const now = new Date();
    const row: ConversationRow = {
      avatar: input.avatar,
      created_at: now,
      created_by: input.created_by,
      id: this.nextConversationId++,
      last_message_id: null,
      last_message_sequence: 0,
      metadata_json: JSON.stringify(input.metadata),
      status: "active",
      title: input.title,
      type: input.type,
      updated_at: now,
      uuid: randomBytes(4).toString("hex")
    };
    this.conversations.push(row);
    return { ...row };
  }

  async findConversation(id: number) {
    const row = this.conversations.find((item) => item.id === id);
    return row ? { ...row } : undefined;
  }

  async findConversationByMember(id: number, userId: number) {
    const member = this.members.find(
      (item) => item.conversation_id === id && item.user_id === userId && item.left_at === null
    );
    if (!member) return undefined;
    return this.findConversation(id);
  }

  async listConversationsForUser(userId: number) {
    const ids = new Set(
      this.members
        .filter((item) => item.user_id === userId && item.left_at === null)
        .map((item) => item.conversation_id)
    );
    return this.conversations
      .filter((item) => item.status === "active" && ids.has(item.id))
      .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime())
      .map((item) => ({ ...item }));
  }

  async addMember(input: NewMemberInput) {
    const row: ConversationMemberRow = {
      archived: false,
      conversation_id: input.conversation_id,
      id: this.nextMemberId++,
      joined_at: new Date(),
      last_read_message_id: null,
      left_at: null,
      muted: false,
      notification_level: "all",
      role: input.role,
      user_id: input.user_id
    };
    this.members.push(row);
    return { ...row };
  }

  async listMembers(conversationId: number) {
    return this.members
      .filter((item) => item.conversation_id === conversationId && item.left_at === null)
      .map((item) => ({ ...item }));
  }

  async findMember(conversationId: number, userId: number) {
    const row = this.members.find(
      (item) => item.conversation_id === conversationId && item.user_id === userId
    );
    return row ? { ...row } : undefined;
  }

  async findMessageById(id: number) {
    const row = this.messages.find((item) => item.id === id);
    return row ? { ...row } : undefined;
  }

  async findLastMessage(conversationId: number) {
    const row = this.messages.filter((item) => item.conversation_id === conversationId && item.deleted_at === null).sort((a, b) => b.sequence_number - a.sequence_number)[0];
    return row ? { ...row } : undefined;
  }

  async countUnreadMessages(conversationId: number, userId: number, lastReadMessageId: number | null) {
    const lastRead = lastReadMessageId === null ? undefined : this.messages.find((item) => item.id === lastReadMessageId);
    const sequence = lastRead?.conversation_id === conversationId ? lastRead.sequence_number : 0;
    return this.messages.filter((item) => item.conversation_id === conversationId && item.sender_id !== userId && item.deleted_at === null && item.sequence_number > sequence).length;
  }

  async markConversationRead(conversationId: number, userId: number, messageId: number) {
    const member = this.members.find((item) => item.conversation_id === conversationId && item.user_id === userId);
    if (member) member.last_read_message_id = messageId;
  }

  async markMessagesReadThrough(conversationId: number, userId: number, sequenceNumber: number) {
    const messages = this.messages.filter(
      (message) =>
        message.conversation_id === conversationId &&
        message.deleted_at === null &&
        message.sender_id !== userId &&
        message.sequence_number <= sequenceNumber
    );
    for (const message of messages) await this.markMessageRead(message.id, userId);
    return messages.map((message) => ({ ...message }));
  }

  async findMessageByClientId(conversationId: number, clientMessageId: string) {
    const row = this.messages.find(
      (item) => item.conversation_id === conversationId && item.client_message_id === clientMessageId
    );
    return row ? { ...row } : undefined;
  }

  async listMessages(conversationId: number, options: { beforeSequence?: number; limit: number }) {
    const before = options.beforeSequence ?? Number.MAX_SAFE_INTEGER;
    return this.messages
      .filter((item) => item.conversation_id === conversationId && item.sequence_number <= before)
      .sort((a, b) => b.sequence_number - a.sequence_number)
      .slice(0, options.limit)
      .map((item) => ({ ...item }));
  }

  async messagesAfterSequence(conversationId: number, afterSequence: number, limit: number) {
    return this.messages
      .filter(
        (item) =>
          item.conversation_id === conversationId &&
          item.sequence_number > afterSequence &&
          item.deleted_at === null
      )
      .sort((a, b) => a.sequence_number - b.sequence_number)
      .slice(0, limit)
      .map((item) => ({ ...item }));
  }

  async listMessageReceiptSummaries(messageIds: number[]) {
    return messageIds.map((messageId) => {
      const receipts = this.receipts.filter((row) => row.message_id === messageId);
      return { deliveredCount: receipts.filter((row) => row.delivered_at !== null).length, messageId, readCount: receipts.filter((row) => row.read_at !== null).length, recipientCount: receipts.length };
    });
  }

  async listMessageReactions(messageIds: number[]) { return this.reactions.filter((row) => messageIds.includes(row.message_id)).map((row) => ({ ...row })); }

  async saveMessage(input: NewMessageInput) {
    const saved = await this.serialize(async () => {
      const conversation = this.conversations.find((item) => item.id === input.conversation_id);
      if (!conversation) throw new Error("Conversation no longer exists for message persistence.");
      const sequence = conversation.last_message_sequence + 1;
      const now = new Date();
      const row: MessageRow = {
        client_message_id: input.client_message_id,
        content: input.content,
        conversation_id: input.conversation_id,
        created_at: now,
        deleted_at: null,
        edited_at: null,
        forwarded_from_message_id: input.forwarded_from_message_id,
        id: this.nextMessageId++,
        metadata_json: JSON.stringify(input.metadata),
        reply_to_message_id: input.reply_to_message_id,
        sender_id: input.sender_id,
        sequence_number: sequence,
        status: "SENT",
        thread_id: input.thread_id,
        type: input.type,
        updated_at: now,
        uuid: randomBytes(4).toString("hex")
      };
      this.messages.push(row);
      conversation.last_message_id = row.id;
      conversation.last_message_sequence = sequence;
      conversation.updated_at = now;
      return { ...row };
    });
    return saved;
  }

  async setMessageStatus(id: number, status: MessageStatus) {
    const row = this.messages.find((item) => item.id === id);
    if (row) row.status = status;
  }

  async saveMessageReceipts(messageId: number, recipientIds: number[]) { for (const user_id of recipientIds) if (!this.receipts.some((row) => row.message_id === messageId && row.user_id === user_id)) this.receipts.push({ delivered_at: null, message_id: messageId, read_at: null, user_id }); }
  async markMessageDelivered(messageId: number, userId: number) { const row = this.receipts.find((receipt) => receipt.message_id === messageId && receipt.user_id === userId); if (row && !row.delivered_at) row.delivered_at = new Date(); }
  async markMessageRead(messageId: number, userId: number) { const row = this.receipts.find((receipt) => receipt.message_id === messageId && receipt.user_id === userId); if (row) { row.delivered_at ??= new Date(); row.read_at = new Date(); } }
  async setMessageReaction(messageId: number, userId: number, emoji: string) { const user = this.users.find((candidate) => candidate.id === userId); const existing = this.reactions.find((reaction) => reaction.message_id === messageId && reaction.user_id === userId); if (existing) existing.emoji = emoji; else this.reactions.push({ emoji, message_id: messageId, user_id: userId, user_name: user?.name ?? `User ${userId}` }); }
  async removeMessageReaction(messageId: number, userId: number) { this.reactions = this.reactions.filter((reaction) => reaction.message_id !== messageId || reaction.user_id !== userId); }

  async findUsersByIds(ids: number[]) {
    const wanted = new Set(ids);
    return this.users.filter((user) => wanted.has(user.id)).map((user) => ({ ...user }));
  }

  async findUsersForMessaging(search: string, excludeUserId: number, limit: number) {
    const term = search.toLocaleLowerCase();
    return this.users
      .filter((user) => user.id !== excludeUserId)
      .filter((user) => !term || `${user.name} ${user.email}`.toLocaleLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, limit)
      .map((user) => ({ ...user }));
  }

  private async serialize<T>(work: () => Promise<T> | T): Promise<T> {
    const result = this.writeQueue.then(work);
    this.writeQueue = result.catch(() => undefined);
    return result;
  }
}
