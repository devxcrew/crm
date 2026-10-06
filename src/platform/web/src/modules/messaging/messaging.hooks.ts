import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createConversation,
  getConversation,
  listConversations,
  listMessages,
  listMessagingContacts,
  sendMessage
} from "./messaging.services";
import type { CreateConversationInput, SendMessageInput } from "./messaging.types";

const conversationsKey = ["messaging", "conversations"] as const;

export function useMessagingConversationsQuery() {
  return useQuery({ queryFn: listConversations, queryKey: conversationsKey });
}

export function useMessagingUserPickerQuery(search = "") {
  return useQuery({
    queryFn: () => listMessagingContacts(search),
    queryKey: ["messaging", "user-picker", search]
  });
}

export function useConversationQuery(id: number | null) {
  return useQuery({
    enabled: id !== null,
    queryFn: () => getConversation(id!),
    queryKey: ["messaging", "conversations", id]
  });
}

export function useMessagingMutations() {
  const queryClient = useQueryClient();
  const invalidateConversations = () => queryClient.invalidateQueries({ queryKey: conversationsKey });
  return {
    createConversation: useMutation({
      mutationFn: (input: CreateConversationInput) => createConversation(input),
      onSuccess: invalidateConversations
    }),
    sendMessage: useMutation({
      mutationFn: ({ conversationId, input }: { conversationId: number; input: SendMessageInput }) =>
        sendMessage(conversationId, input)
    })
  };
}

export function useMessagesQuery(conversationId: number | null) {
  return useQuery({
    enabled: conversationId !== null,
    queryFn: () => listMessages(conversationId!),
    queryKey: ["messaging", "messages", conversationId]
  });
}
