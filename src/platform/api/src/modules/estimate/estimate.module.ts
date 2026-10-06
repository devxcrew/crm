import { defineModule } from "@codexsun/framework/modules";
import type { PlatformModuleDependencies } from "../../module-dependencies.js";
import { registerEstimateRoutes } from "./estimate.routes.js";

/** Estimate owns the CRM UI/API contract; Frappe remains its source of truth. */
export const estimateModule = defineModule<PlatformModuleDependencies>({
  key: "estimate",
  label: "Estimate",
  register: ({ app }) => registerEstimateRoutes(app)
});
