import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getFrappeConnectionSettings,
  importFrappeUser,
  previewFrappeUsers,
  saveFrappeConnectionSettings,
  verifyFrappeConnection
} from "./frappe.services";

export const frappeConnectionQueryKey = ["settings", "frappe", "connection"] as const;
export const frappeUserPreviewQueryKey = ["settings", "frappe", "users", "preview"] as const;

export function useFrappeConnectionQuery() {
  return useQuery({
    queryFn: getFrappeConnectionSettings,
    queryKey: frappeConnectionQueryKey
  });
}

export function useFrappeConnectionMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: saveFrappeConnectionSettings,
    onSuccess: (record) => {
      client.setQueryData(frappeConnectionQueryKey, record);
    }
  });
}

export function useFrappeConnectionVerificationMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: verifyFrappeConnection,
    onSettled: () => client.invalidateQueries({ queryKey: frappeConnectionQueryKey })
  });
}

export function useFrappeUserPreviewQuery() {
  return useQuery({
    queryFn: previewFrappeUsers,
    queryKey: frappeUserPreviewQueryKey
  });
}

export function useFrappeUserImportMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: importFrappeUser,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: frappeUserPreviewQueryKey });
      void client.invalidateQueries({ queryKey: ["identity", "users"] });
    }
  });
}
