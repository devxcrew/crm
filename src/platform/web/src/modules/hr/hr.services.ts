import { apiGet, apiPost, apiPut } from "../../shared/api/platform-api";
import type {
  HrDuty,
  HrStaffRequest,
  HrStaffRequestSavePayload,
  HrStaffRequestView
} from "./hr.types";

const path = "/hr/requests";

export function listHrDuties() {
  return apiGet<HrDuty[]>("/hr/duties");
}

export function reportHrDuty(sopItem: string, actions: string) {
  return apiPost<HrDuty>(`/hr/duties/${encodeURIComponent(sopItem)}/reports`, { actions });
}

export function approveHrStaffRequest(name: string) {
  return apiPost<HrStaffRequest>(`${path}/${encodeURIComponent(name)}/approve`, {});
}

export function createHrStaffRequest(payload: HrStaffRequestSavePayload) {
  return apiPost<HrStaffRequest>(path, payload);
}

export function getHrStaffRequest(name: string) {
  return apiGet<HrStaffRequest>(`${path}/${encodeURIComponent(name)}`);
}

export function listHrStaffRequests(view: HrStaffRequestView) {
  return apiGet<HrStaffRequest[]>(`${path}?${new URLSearchParams({ view })}`);
}

export function updateHrStaffRequest(name: string, payload: HrStaffRequestSavePayload) {
  return apiPut<HrStaffRequest>(`${path}/${encodeURIComponent(name)}`, payload);
}
