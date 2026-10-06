import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createQuotation,
  listQuotationReferences,
  listQuotations,
  updateQuotation
} from "./quotation.services";
import type { QuotationSavePayload } from "./quotation.types";

export const quotationQueryKey = ["quotation"] as const;

export function useQuotationsQuery(enquiry: string) {
  return useQuery({
    queryFn: () => listQuotations(enquiry),
    queryKey: [...quotationQueryKey, enquiry]
  });
}

export function useQuotationReferencesQuery(enabled: boolean) {
  return useQuery({
    enabled,
    queryFn: listQuotationReferences,
    queryKey: [...quotationQueryKey, "references"]
  });
}

export function useQuotationMutations(enquiry: string) {
  const client = useQueryClient();
  const done = () => client.invalidateQueries({ queryKey: [...quotationQueryKey, enquiry] });
  return {
    create: useMutation({
      mutationFn: (payload: QuotationSavePayload) => createQuotation(enquiry, payload),
      onSuccess: done
    }),
    update: useMutation({
      mutationFn: ({ name, payload }: { name: string; payload: QuotationSavePayload }) =>
        updateQuotation(name, enquiry, payload),
      onSuccess: done
    })
  };
}
