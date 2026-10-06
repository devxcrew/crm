import { defineModule } from "@codexsun/framework/modules";
import type { PlatformModuleDependencies } from "../../module-dependencies.js";
import { registerHrRoutes } from "./hr.routes.js";

/** HR request records remain on Frappe. This module owns only the CRM contract and access rules. */
export const hrModule = defineModule<PlatformModuleDependencies>({
  key: "hr.request",
  label: "HR Requests",
  register: ({ app, frappeLiveSopDutyGateway, frappeLiveStaffRequestGateway }) =>
    registerHrRoutes(app, frappeLiveStaffRequestGateway, frappeLiveSopDutyGateway)
});
