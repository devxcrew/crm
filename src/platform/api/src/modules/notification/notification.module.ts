import { defineModule } from "@codexsun/framework/modules";
import type { PlatformModuleDependencies } from "../../module-dependencies.js";
import { registerNotificationRoutes } from "./notification.routes.js";

export const notificationModule = defineModule<PlatformModuleDependencies>({
  key: "notification.inbox",
  label: "Notifications",
  register: ({ app }) => registerNotificationRoutes(app)
});
