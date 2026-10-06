import { createApiApp, registerHealthRoute, registerRequestLogging } from "@codexsun/framework/api";
import type { HealthCheck } from "@codexsun/framework/health";
import { registerModules } from "@codexsun/framework/modules";
import { registerAuthRoutes } from "./auth/auth.routes.js";
import {
  bootstrapTechMediaDatabase,
  closeTechMediaDatabase,
  getTechMediaDatabase
} from "./database/techmedia-database.js";
import { env } from "./env.js";
import { crmModule } from "./modules/crm/index.js";
import { hrModule } from "./modules/hr/index.js";
import { estimateModule } from "./modules/estimate/index.js";
import {
  frappeLiveEnquiryGatewayContract,
  frappeLiveSopDutyGatewayContract,
  frappeLiveStaffRequestGatewayContract,
  frappeModule
} from "./modules/frappe/index.js";
import { permissionModule } from "./modules/permission/index.js";
import { createNotificationPublisher, notificationModule } from "./modules/notification/index.js";
import { quotationModule } from "./modules/quotation/index.js";
import { rolePermissionModule } from "./modules/role-permission/index.js";
import { roleModule } from "./modules/role/index.js";
import { userRoleModule } from "./modules/user-role/index.js";
import { userModule } from "./modules/user/index.js";
import { honeyModule } from "./modules/honey/index.js";
import { ishopModule } from "./modules/ishop/index.js";
import { messagingModule } from "./modules/messaging/index.js";
import { brandingModule } from "./modules/branding/index.js";
import { registerMobileReleaseRoutes } from "./mobile-release/mobile-release.routes.js";

const modules = [
  userModule,
  roleModule,
  permissionModule,
  userRoleModule,
  rolePermissionModule,
  frappeModule,
  notificationModule,
  brandingModule,
  crmModule,
  hrModule,
  estimateModule,
  quotationModule,
  ishopModule,
  honeyModule,
  messagingModule
];

export async function createApp() {
  console.info("[techmedia.boot] bootstrap started");
  await bootstrapTechMediaDatabase();

  const app = await createApiApp({
    appName: "CRM API",
    cookieSecret: env.JWT_SECRET,
    corsOrigins: platformWebOrigins(),
    environment: env.NODE_ENV,
    shutdownHooks: [closeTechMediaDatabase]
  });
  const healthChecks: HealthCheck[] = [
    {
      name: "techmedia-api",
      check: () => ({
        details: {
          database: env.DB_NAME,
          modules: modules.map((module) => module.key),
          runtime: "single-client"
        },
        status: "ok"
      })
    }
  ];

  registerRequestLogging(app);
  registerHealthRoute(app, healthChecks);
  registerMobileReleaseRoutes(app, env.MOBILE_RELEASE_STORAGE_ROOT);
  await registerAuthRoutes(app);
  await registerModules(
    modules,
    {
      app,
      frappeLiveEnquiryGateway: frappeLiveEnquiryGatewayContract,
      frappeLiveSopDutyGateway: frappeLiveSopDutyGatewayContract,
      frappeLiveStaffRequestGateway: frappeLiveStaffRequestGatewayContract,
      notificationPublisher: createNotificationPublisher(getTechMediaDatabase())
    },
    {
      onRegister: (module) => console.info(`[module.register] ${module.key}`),
      onReady: (module) => console.info(`[module.ready] ${module.key}`)
    }
  );
  console.info("[techmedia.boot] bootstrap completed");

  return app;
}

function platformWebOrigins() {
  const configuredOrigins = [env.PLATFORM_WEB_ORIGIN, ...env.PLATFORM_WEB_ORIGINS.split(",")];
  if (env.NODE_ENV !== "production") {
    configuredOrigins.push(
      `http://127.0.0.1:${env.PLATFORM_WEB_PORT}`,
      `http://localhost:${env.PLATFORM_WEB_PORT}`
    );
  }

  return Array.from(
    new Set(
      configuredOrigins
        .map((origin) => origin.trim())
        .filter(Boolean)
        .flatMap(localOriginAliases)
        .map((origin) => origin.trim().replace(/\/$/u, ""))
    )
  );
}

function localOriginAliases(origin: string) {
  const origins = [origin];
  const url = new URL(origin);
  if (url.hostname === "localhost") {
    url.hostname = "127.0.0.1";
    origins.push(url.origin);
  } else if (url.hostname === "127.0.0.1") {
    url.hostname = "localhost";
    origins.push(url.origin);
  }
  return origins;
}
