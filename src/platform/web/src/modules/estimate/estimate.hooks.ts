import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createEstimate,
  listEstimateReferences,
  listEstimates,
  updateEstimate
} from "./estimate.services";
import type { EstimateSavePayload } from "./estimate.types";

export const estimateQueryKey = ["estimate"] as const;

export function useEstimatesQuery(enquiry?: string) {
  return useQuery({
    queryFn: () => listEstimates(enquiry),
    queryKey: [...estimateQueryKey, enquiry ?? "all"]
  });
}

export function useEstimateReferencesQuery(enabled: boolean) {
  return useQuery({
    enabled,
    queryFn: listEstimateReferences,
    queryKey: [...estimateQueryKey, "references"]
  });
}

export function useEstimateMutations() {
  const client = useQueryClient();
  const done = () => client.invalidateQueries({ queryKey: estimateQueryKey });
  return {
    create: useMutation({ mutationFn: createEstimate, onSuccess: done }),
    update: useMutation({
      mutationFn: ({ name, payload }: { name: string; payload: EstimateSavePayload }) =>
        updateEstimate(name, payload),
      onSuccess: done
    })
  };
}
