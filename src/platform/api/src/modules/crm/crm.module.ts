import { defineModule } from "@codexsun/framework/modules";
import type { PlatformModuleDependencies } from "../../module-dependencies.js";
import { registerCrmRoutes } from "./crm.routes.js";

/** CRM owns the Enquiry UI contract; Frappe is the live record source of truth. */
export const crmModule = defineModule<PlatformModuleDependencies>({
  key: "crm.enquiry",
  label: "CRM Enquiries",
  register: ({ app, frappeLiveEnquiryGateway, notificationPublisher }) =>
    registerCrmRoutes(app, frappeLiveEnquiryGateway, notificationPublisher)
});
