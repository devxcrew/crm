import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { registerContractRoute } from "@codexsun/framework/http";
import { identityContext } from "../../auth/identity-context.js";
import { FrappeService } from "./frappe.service.js";

const path = "/settings/frappe";
const verificationPath = `${path}/verify`;
const userSyncPath = "/settings/frappe/users";
const payload = z
  .object({
    appKey: z.string().trim().min(1).max(2_000).optional(),
    appSecret: z.string().trim().min(1).max(2_000).optional(),
    baseUrl: z.string().trim().min(1).max(500),
    connectionName: z.string().trim().min(2).max(160),
    enabled: z.boolean(),
    saveToEnvironment: z.literal(true)
  })
  .strict();
const record = z.object({
  appKeyConfigured: z.boolean(),
  appSecretConfigured: z.boolean(),
  baseUrl: z.string(),
  connectionName: z.string(),
  enabled: z.boolean(),
  id: z.number().int().positive(),
  lastCheckedAt: z.iso.datetime().nullable(),
  lastVerifiedAt: z.iso.datetime().nullable(),
  updatedAt: z.iso.datetime(),
  uuid: z.string().length(8),
  verificationStatus: z.enum(["live", "offline", "unverified"])
});
const verificationPayload = z
  .object({
    appKey: z.string().trim().min(1).max(2_000).optional(),
    appSecret: z.string().trim().min(1).max(2_000).optional(),
    baseUrl: z.string().trim().min(1).max(500)
  })
  .strict();
const verificationResult = z.object({
  authenticatedUser: z.string().min(1),
  baseUrl: z.string(),
  checkedAt: z.iso.datetime(),
  connected: z.literal(true),
  latencyMs: z.number().int().nonnegative()
});
const userVerificationResult = verificationResult.extend({ employeeCode: z.string().min(1) });
const userPreview = z.object({
  email: z.string().email(),
  enabled: z.boolean(),
  frappeUserId: z.string().min(1),
  lastActiveAt: z.string().nullable(),
  localStatus: z.enum(["active", "inactive", "suspended"]).nullable(),
  localUserId: z.number().int().positive().nullable(),
  name: z.string().min(1),
  userType: z.string().min(1)
});
const userImportPayload = z.object({ frappeUserId: z.string().trim().min(1).max(255) }).strict();
const userImportResult = z.object({
  created: z.boolean(),
  temporaryPassword: z.string().nullable(),
  user: z.object({
    email: z.string().email(),
    id: z.number().int().positive(),
    name: z.string().min(1),
    status: z.enum(["active", "inactive", "suspended"]),
    uuid: z.string().length(8)
  })
});

export async function registerFrappeRoutes(app: FastifyInstance) {
  registerContractRoute(app, {
    method: "GET",
    url: path,
    schemas: { response: record.nullable() },
    handler: ({ request }) => new FrappeService(identityContext(request)).get()
  });
  registerContractRoute(app, {
    method: "PUT",
    url: path,
    schemas: { body: payload, response: record },
    handler: ({ body, request }) =>
      new FrappeService(identityContext(request)).save({
        ...(body.appKey ? { appKey: body.appKey } : {}),
        ...(body.appSecret ? { appSecret: body.appSecret } : {}),
        baseUrl: body.baseUrl,
        connectionName: body.connectionName,
        enabled: body.enabled,
        saveToEnvironment: body.saveToEnvironment
      })
  });
  registerContractRoute(app, {
    method: "POST",
    url: verificationPath,
    schemas: { body: verificationPayload, response: verificationResult },
    handler: ({ body, request }) =>
      new FrappeService(identityContext(request)).verify({
        ...(body.appKey ? { appKey: body.appKey } : {}),
        ...(body.appSecret ? { appSecret: body.appSecret } : {}),
        baseUrl: body.baseUrl
      })
  });
  registerContractRoute(app, {
    method: "POST",
    url: `${path}/users/:id/verify`,
    schemas: {
      params: z.object({ id: z.coerce.number().int().positive() }),
      response: userVerificationResult
    },
    handler: ({ params, request }) =>
      new FrappeService(identityContext(request)).verifyUser(params.id)
  });
  registerContractRoute(app, {
    method: "GET",
    url: `${userSyncPath}/preview`,
    schemas: { response: z.array(userPreview) },
    handler: ({ request }) => new FrappeService(identityContext(request)).previewUsers()
  });
  registerContractRoute(app, {
    method: "POST",
    url: `${userSyncPath}/import`,
    schemas: { body: userImportPayload, response: userImportResult },
    handler: ({ body, request }) =>
      new FrappeService(identityContext(request)).importUser(body.frappeUserId)
  });
}
