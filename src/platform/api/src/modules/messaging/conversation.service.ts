import { AppError } from "@codexsun/framework/errors";
import { recordAuditEvent } from "../../database/audit.js";
import { toConversationDto, toMemberDto, toMessageDto } from "./messaging.mapper.js";
import type { ConversationDto, ConversationMemberDto, MessagingContext } from "./messaging.types.js";
import type { MessagingRepository } from "./messaging.repositories.js";
import type { ConversationMemberRole, ConversationType } from "../../database/schema.js";

export type CreateConversationInput = {
  memberIds: number[];
  metadata?: Record<string, unknown> | undefined;
  title?: string | null | undefined;
  type: ConversationType;
};

export class ConversationService {
  constructor(
    private readonly context: MessagingContext,
    private readonly repository: MessagingRepository
  ) {}

  async list(): Promise<ConversationDto[]> {
    const actor = await this.requireActor();
    const rows = await this.repository.listConversationsForUser(actor.id);
    const conversations: ConversationDto[] = [];
    for (const row of rows) {
      const members = await this.repository.listMembers(row.id);
      const users = await this.repository.findUsersByIds(members.map((member) => member.user_id));
      const actorMember = members.find((member) => member.user_id === actor.id);
      const lastMessage = await this.repository.findLastMessage(row.id);
      const sender = lastMessage ? (await this.repository.findUsersByIds([lastMessage.sender_id]))[0] : undefined;
      conversations.push({
        ...toConversationDto(row, members, users),
        lastMessage: lastMessage ? toMessageDto(lastMessage, sender) : null,
        unreadCount: await this.repository.countUnreadMessages(row.id, actor.id, actorMember?.last_read_message_id ?? null)
      });
    }
    return conversations;
  }

  async listContacts(search: string) {
    const actor = await this.requireActor();
    return this.repository.findUsersForMessaging(search.trim(), actor.id, 100);
  }

  async get(id: number): Promise<ConversationDto> {
    const actor = await this.requireActor();
    const row = await this.repository.findConversationByMember(id, actor.id);
    if (!row) throw AppError.notFound("Conversation was not found.");
    const members = await this.repository.listMembers(row.id);
    const users = await this.repository.findUsersByIds(members.map((member) => member.user_id));
    return this.enrich(toConversationDto(row, members, users), actor.id);
  }

  async create(input: CreateConversationInput): Promise<ConversationDto> {
    const actor = await this.requireActor();
    this.assertConversationMembers(input, actor.id);
    const memberIds = uniquePositiveIds([actor.id, ...input.memberIds]);
    const users = await this.repository.findUsersByIds(memberIds);
    if (users.length !== memberIds.length) {
      throw AppError.validation("One or more members are not active users.");
    }
    if (input.type === "DIRECT" && memberIds.length === 2) {
      const existing = await this.findDirectConversation(actor.id, memberIds);
      if (existing) return existing;
    }
    const row = await this.repository.createConversation({
      avatar: null,
      created_by: actor.id,
      metadata: input.metadata ?? {},
      title: input.title ?? null,
      type: input.type
    });
    await this.repository.addMember({ conversation_id: row.id, role: "OWNER", user_id: actor.id });
    for (const userId of memberIds) {
      if (userId === actor.id) continue;
      await this.repository.addMember({ conversation_id: row.id, role: "MEMBER", user_id: userId });
    }
    const members = await this.repository.listMembers(row.id);
    await recordAuditEvent({
      action: "conversation.created",
      actorEmail: actor.email,
      moduleKey: "messaging",
      recordId: row.id,
      recordLabel: row.title ?? String(row.id),
      recordUuid: row.uuid
    });
    return this.enrich(toConversationDto(row, members, users), actor.id);
  }

  async addMember(
    conversationId: number,
    userId: number,
    role: ConversationMemberRole
  ): Promise<ConversationMemberDto> {
    const actor = await this.requireActor();
    const conversation = await this.repository.findConversationByMember(conversationId, actor.id);
    if (!conversation) throw AppError.notFound("Conversation was not found.");
    const actorMember = await this.repository.findMember(conversationId, actor.id);
    if (!actorMember || !["OWNER", "ADMIN"].includes(actorMember.role)) {
      throw AppError.forbidden("Only conversation owners and administrators can add members.");
    }
    const [target] = await this.repository.findUsersByIds([userId]);
    if (!target) throw AppError.validation("Member must be an active user.");
    const existing = await this.repository.findMember(conversationId, userId);
    if (existing) throw AppError.conflict("User is already a member of this conversation.");
    const member = await this.repository.addMember({
      conversation_id: conversationId,
      role,
      user_id: userId
    });
    await recordAuditEvent({
      action: "conversation.member.added",
      actorEmail: actor.email,
      moduleKey: "messaging",
      recordId: conversationId,
      recordLabel: target.name,
      recordUuid: conversation.uuid
    });
    return toMemberDto(member, target);
  }

  private async findDirectConversation(actorId: number, memberIds: number[]) {
    const conversations = await this.repository.listConversationsForUser(actorId);
    for (const row of conversations) {
      if (row.type !== "DIRECT") continue;
      const members = await this.repository.listMembers(row.id);
      const ids = members.map((member) => member.user_id).sort((a, b) => a - b);
      const wanted = [...memberIds].sort((a, b) => a - b);
      if (ids.length !== wanted.length || ids.some((id, index) => id !== wanted[index])) continue;
      const users = await this.repository.findUsersByIds(ids);
      return this.enrich(toConversationDto(row, members, users), actorId);
    }
    return undefined;
  }

  private assertConversationMembers(input: CreateConversationInput, actorId: number): void {
    if (input.type !== "DIRECT") return;
    const targetIds = uniquePositiveIds(input.memberIds);
    if (targetIds.length !== 1 || targetIds[0] === actorId) {
      throw AppError.validation("A direct chat must include exactly one other active user.");
    }
  }

  private async requireActor() {
    const actor = await this.context.actorUser();
    if (!actor) throw AppError.unauthorized("An active user is required.");
    return actor;
  }

  private async enrich(conversation: ConversationDto, actorId: number): Promise<ConversationDto> {
    const member = await this.repository.findMember(conversation.id, actorId);
    const lastMessage = await this.repository.findLastMessage(conversation.id);
    const sender = lastMessage ? (await this.repository.findUsersByIds([lastMessage.sender_id]))[0] : undefined;
    return {
      ...conversation,
      lastMessage: lastMessage ? toMessageDto(lastMessage, sender) : null,
      unreadCount: await this.repository.countUnreadMessages(conversation.id, actorId, member?.last_read_message_id ?? null)
    };
  }
}

function uniquePositiveIds(values: number[]): number[] {
  const set = new Set<number>();
  for (const value of values) {
    if (Number.isInteger(value) && value > 0) set.add(value);
  }
  return [...set];
}
