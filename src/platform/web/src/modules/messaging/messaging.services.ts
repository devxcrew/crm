import { apiGet, apiPost, getToken } from "../../shared/api/platform-api";
import { requiredClientEnv } from "../../shared/env/client-env";
import type {
  Conversation,
  CreateConversationInput,
  Message,
  MessagingContact,
  SendMessageInput
} from "./messaging.types";

const path = "/messaging";

export function listConversations() {
  return apiGet<Conversation[]>(`${path}/conversations`);
}

export function listMessagingContacts(search = "") {
  const query = new URLSearchParams({ search: search.trim() });
  return apiGet<MessagingContact[]>(`${path}/contacts?${query}`);
}

export function getConversation(id: number) {
  return apiGet<Conversation>(`${path}/conversations/${id}`);
}

export function createConversation(input: CreateConversationInput) {
  return apiPost<Conversation>(`${path}/conversations`, input);
}

export function listMessages(conversationId: number, beforeSequence?: number) {
  const query = new URLSearchParams();
  query.set("limit", "200");
  if (beforeSequence !== undefined) query.set("beforeSequence", String(beforeSequence));
  return apiGet<Message[]>(`${path}/conversations/${conversationId}/messages?${query.toString()}`);
}

export function sendMessage(conversationId: number, input: SendMessageInput) {
  return apiPost<Message>(`${path}/conversations/${conversationId}/messages`, input);
}

export function markConversationRead(conversationId: number, messageId: number) {
  return apiPost<{ messageId: number }>(`${path}/conversations/${conversationId}/read`, { messageId });
}

export function reactToMessage(conversationId: number, messageId: number, emoji: string | null) {
  return apiPost<Message>(`${path}/conversations/${conversationId}/messages/${messageId}/reaction`, { emoji });
}

export async function fetchMessagingAttachment(path: string) {
  if (isInlineAttachment(path)) return path;
  const response = await fetch(`${requiredClientEnv("VITE_PLATFORM_API_URL")}${path}`, { headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {} });
  if (!response.ok) throw new Error("Attachment could not be downloaded.");
  return URL.createObjectURL(await response.blob());
}

export async function downloadMessagingAttachment(path: string, name: string) {
  const source = await fetchMessagingAttachment(path);
  const link = document.createElement("a");
  link.download = name;
  link.href = source;
  link.click();
  if (!isInlineAttachment(source)) window.setTimeout(() => URL.revokeObjectURL(source), 1_000);
}

function isInlineAttachment(value: string) {
  return value.startsWith("data:");
}
