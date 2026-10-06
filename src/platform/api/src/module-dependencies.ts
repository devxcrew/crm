import type { FastifyInstance } from "fastify";
import type {
  FrappeLiveEnquiryGatewayFactory,
  FrappeLiveSopDutyGatewayFactory,
  FrappeLiveStaffRequestGatewayFactory
} from "./modules/frappe/frappe.types.js";
import type { NotificationPublisher } from "./modules/notification/notification.types.js";

/** Dependencies available to every Platform module at composition time. */
export type PlatformModuleDependencies = {
  app: FastifyInstance;
  frappeLiveEnquiryGateway: FrappeLiveEnquiryGatewayFactory;
  frappeLiveSopDutyGateway: FrappeLiveSopDutyGatewayFactory;
  frappeLiveStaffRequestGateway: FrappeLiveStaffRequestGatewayFactory;
  notificationPublisher: NotificationPublisher;
};
