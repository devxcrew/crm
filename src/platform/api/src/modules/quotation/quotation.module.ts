import { defineModule } from "@codexsun/framework/modules";
import type { PlatformModuleDependencies } from "../../module-dependencies.js";
import { registerQuotationRoutes } from "./quotation.routes.js";

/** Quotation owns the CRM UI/API contract; Frappe remains its source of truth. */
export const quotationModule = defineModule<PlatformModuleDependencies>({
  key: "quotation",
  label: "Quotation",
  register: ({ app }) => registerQuotationRoutes(app)
});
