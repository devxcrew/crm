import { apiGet, apiPost, apiPut } from "../../shared/api/platform-api";
export type HoneyMessage = {
  body: string;
  createdAt: string;
  id: string;
  metadata: { mode?: string; workers?: Array<{ name: string; output: string }> };
  role: "assistant" | "user";
};
export type HoneyConversation = { id: string; messages: HoneyMessage[] };
export type HoneyOverview = {
  conversationCount: number;
  promptCount: number;
  responseCount: number;
};
export type HoneyAvailability = { enabled: boolean };
export type HoneyPetVisibility = { mobileEnabled: boolean; webEnabled: boolean };
export const getHoneyAvailability = () => apiGet<HoneyAvailability>("/ai/honey/settings");
export const updateHoneyAvailability = (enabled: boolean) =>
  apiPut<HoneyAvailability>("/ai/honey/settings", { enabled });
export const getHoneyPetVisibility = () => apiGet<HoneyPetVisibility>("/ai/honey/pet-settings");
export const updateHoneyPetVisibility = (visibility: HoneyPetVisibility) =>
  apiPut<HoneyPetVisibility>("/ai/honey/pet-settings", visibility);
export const getHoneyOverview = () => apiGet<HoneyOverview>("/ai/honey/overview");
export const listHoneyConversations = () =>
  apiGet<Array<{ id: string; title: string; updatedAt: string }>>("/ai/honey/conversations");
export const getHoneyConversation = (id: string) =>
  apiGet<HoneyConversation>(`/ai/honey/conversations/${id}`);
export const archiveHoneyConversation = (id: string) =>
  apiPost<{ archived: true }>(`/ai/honey/conversations/${id}/archive`);
export const sendHoneyMessage = (
  message: string,
  mode: "assistant" | "content-writer",
  threadId: string | null
) => apiPost<HoneyConversation>("/ai/honey/chat", { message, mode, threadId });
