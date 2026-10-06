import { apiGet, apiPost, apiPut } from "../../shared/api/platform-api";
import type {
  FrappeConnectionSavePayload,
  FrappeConnectionSettings,
  FrappeConnectionVerificationPayload,
  FrappeConnectionVerificationResult,
  FrappeUserImportResult,
  FrappeUserPreview
} from "./frappe.types";

const path = "/settings/frappe";

export function getFrappeConnectionSettings() {
  return apiGet<FrappeConnectionSettings | null>(path);
}

export function saveFrappeConnectionSettings(payload: FrappeConnectionSavePayload) {
  return apiPut<FrappeConnectionSettings>(path, payload);
}

export function verifyFrappeConnection(payload: FrappeConnectionVerificationPayload) {
  return apiPost<FrappeConnectionVerificationResult>(`${path}/verify`, payload);
}

const userSyncPath = "/settings/frappe/users";

export function previewFrappeUsers() {
  return apiGet<FrappeUserPreview[]>(`${userSyncPath}/preview`);
}

export function importFrappeUser(frappeUserId: string) {
  return apiPost<FrappeUserImportResult>(`${userSyncPath}/import`, { frappeUserId });
}
