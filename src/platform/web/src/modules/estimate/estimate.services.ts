import { apiGet, apiPost, apiPut } from "../../shared/api/platform-api";
import type { Estimate, EstimateReferences, EstimateSavePayload } from "./estimate.types";

const path = "/estimates";

export function listEstimates(enquiry?: string) {
  return apiGet<Estimate[]>(
    enquiry ? `${path}?${new URLSearchParams({ enquiry }).toString()}` : path
  );
}

export function listEstimateReferences() {
  return apiGet<EstimateReferences>(`${path}/references`);
}

export function getEstimate(name: string) {
  return apiGet<Estimate>(`${path}/${encodeURIComponent(name)}`);
}

export function createEstimate(payload: EstimateSavePayload) {
  return apiPost<Estimate>(path, payload);
}

export function updateEstimate(name: string, payload: EstimateSavePayload) {
  return apiPut<Estimate>(`${path}/${encodeURIComponent(name)}`, payload);
}
