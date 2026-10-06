import {
  DESIGN_SYSTEM_DEFAULT_STORAGE_KEY,
  DESIGN_SYSTEM_NAME,
  DESIGN_SYSTEM_VARIANT_MARKER,
  defaultDesignSystemVariantId
} from "@codexsun/ui/design-system";

export function applyDesignSystemPreference() {
  document.documentElement.setAttribute("data-design-system", DESIGN_SYSTEM_NAME);
  document.documentElement.setAttribute(DESIGN_SYSTEM_VARIANT_MARKER, defaultDesignSystemVariantId);
  window.localStorage.setItem(DESIGN_SYSTEM_DEFAULT_STORAGE_KEY, defaultDesignSystemVariantId);
}
