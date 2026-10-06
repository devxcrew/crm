import { defineModule } from "@codexsun/framework/modules";
import type { PlatformModuleDependencies } from "../../module-dependencies.js";
import { registerHoneyRoutes } from "./honey.routes.js";
export const honeyModule = defineModule<PlatformModuleDependencies>({
  key: "ai.honey",
  label: "TEMA AI",
  register: ({ app }) => registerHoneyRoutes(app)
});
