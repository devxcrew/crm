import { updateRuntimeEnvironment } from "../../runtime/environment-store.js";
import type { AppBrandingInput } from "./branding.service.js";

const brandingKeys = ["APP_BRAND_NAME", "APP_BRAND_TAGLINE"] as const;

export function updateBrandingEnvironment(input: AppBrandingInput) {
  return updateRuntimeEnvironment({
    failureCode: "BRANDING_SETTINGS_SAVE_FAILED",
    failureLabel: "App branding",
    keys: brandingKeys,
    values: { APP_BRAND_NAME: input.title, APP_BRAND_TAGLINE: input.tagline }
  });
}
