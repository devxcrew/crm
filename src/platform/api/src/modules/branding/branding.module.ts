import { defineModule } from "@codexsun/framework/modules";
import type { PlatformModuleDependencies } from "../../module-dependencies.js";
import { registerBrandingRoutes } from "./branding.routes.js";

export const brandingModule = defineModule<PlatformModuleDependencies>({
  key: "app.branding",
  label: "App branding",
  register: ({ app }) => registerBrandingRoutes(app)
});
