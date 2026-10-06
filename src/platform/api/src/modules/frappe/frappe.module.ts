import { defineModule } from "@codexsun/framework/modules";
import type { PlatformModuleDependencies } from "../../module-dependencies.js";
import { registerFrappeRoutes } from "./frappe.routes.js";

/**
 * Frappe owns the single CRM connection, per-user verification, and remote-user import.
 * The singleton connection intentionally has no delete or active/inactive CRUD lifecycle.
 */
export const frappeModule = defineModule<PlatformModuleDependencies>({
  key: "settings.frappe",
  label: "Frappe Connection",
  register: ({ app }) => registerFrappeRoutes(app)
});
