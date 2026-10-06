import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approveHrStaffRequest,
  createHrStaffRequest,
  getHrStaffRequest,
  listHrDuties,
  listHrStaffRequests,
  reportHrDuty,
  updateHrStaffRequest
} from "./hr.services";
import type { HrStaffRequestSavePayload, HrStaffRequestView } from "./hr.types";

const key = ["hr", "staff-requests"] as const;
const dutyKey = ["hr", "duties"] as const;

export function useHrDutiesQuery() {
  return useQuery({ queryFn: listHrDuties, queryKey: dutyKey });
}

export function useHrDutyMutations() {
  const queryClient = useQueryClient();
  return {
    report: useMutation({
      mutationFn: ({ actions, sopItem }: { actions: string; sopItem: string }) =>
        reportHrDuty(sopItem, actions),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: dutyKey })
    })
  };
}

export function useHrStaffRequestsQuery(view: HrStaffRequestView) {
  return useQuery({ queryFn: () => listHrStaffRequests(view), queryKey: [...key, view] });
}

export function useHrStaffRequestMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });
  return {
    approve: useMutation({ mutationFn: approveHrStaffRequest, onSuccess: invalidate }),
    create: useMutation({ mutationFn: createHrStaffRequest, onSuccess: invalidate }),
    get: useMutation({ mutationFn: getHrStaffRequest }),
    update: useMutation({
      mutationFn: ({ name, payload }: { name: string; payload: HrStaffRequestSavePayload }) =>
        updateHrStaffRequest(name, payload),
      onSuccess: invalidate
    })
  };
}
