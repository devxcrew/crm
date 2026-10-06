import { updateRuntimeEnvironment } from "../../runtime/environment-store.js";

const writableKeys = [
  "FRAPPE_APP_KEY",
  "FRAPPE_APP_SECRET",
  "FRAPPE_BASE_URL",
  "FRAPPE_CONNECTION_NAME",
  "FRAPPE_ENABLED",
  "FRAPPE_LAST_CHECKED_AT",
  "FRAPPE_LAST_VERIFIED_AT",
  "FRAPPE_UPDATED_AT",
  "FRAPPE_VERIFICATION_STATUS"
] as const;

export type FrappeEnvironmentUpdate = Partial<Record<(typeof writableKeys)[number], string>>;

export function updateFrappeEnvironment(values: FrappeEnvironmentUpdate) {
  return updateRuntimeEnvironment({
    failureCode: "FRAPPE_SETTINGS_SAVE_FAILED",
    failureLabel: "Frappe settings",
    keys: writableKeys,
    values
  });
}
