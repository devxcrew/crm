import type { FastifyInstance } from "fastify";
import { registerContractRoute } from "@codexsun/framework/http";
import { ok } from "@codexsun/framework/http";
import { AppError } from "@codexsun/framework/errors";
import { z } from "zod";
import { identityContext } from "../../auth/identity-context.js";
import { HoneyService } from "./honey.service.js";
import { HoneyModelGateway } from "./honey.gateway.js";
import { HoneySettingsService } from "./honey-settings.service.js";
import { codexConnector } from "./codex-connector.service.js";

const message = z.object({
  body: z.string(),
  createdAt: z.coerce.date(),
  id: z.uuid(),
  metadata: z.unknown(),
  role: z.enum(["assistant", "user"])
});
const conversation = z.object({ id: z.uuid(), messages: z.array(message) });
const params = z.object({ id: z.uuid() });
const overview = z.object({
  conversationCount: z.number().int().nonnegative(),
  promptCount: z.number().int().nonnegative(),
  responseCount: z.number().int().nonnegative()
});
const availability = z.object({ enabled: z.boolean() });
const petVisibility = z.object({ mobileEnabled: z.boolean(), webEnabled: z.boolean() });

export function registerHoneyRoutes(app: FastifyInstance) {
  registerContractRoute(app, {
    method: "GET",
    url: "/ai/honey/settings",
    schemas: { response: availability },
    handler: ({ request }) => honeySettings(request).availability()
  });
  registerContractRoute(app, {
    method: "GET",
    url: "/ai/honey/pet-settings",
    schemas: { response: petVisibility },
    handler: ({ request }) => honeySettings(request).petVisibility()
  });
  registerContractRoute(app, {
    method: "PUT",
    url: "/ai/honey/pet-settings",
    schemas: { body: petVisibility, response: petVisibility },
    handler: ({ body, request }) => honeySettings(request).updatePetVisibility(body)
  });
  registerContractRoute(app, {
    method: "PUT",
    url: "/ai/honey/settings",
    schemas: { body: availability, response: availability },
    handler: ({ body, request }) => honeySettings(request).updateAvailability(body.enabled)
  });
  app.get("/ai/connector/status", async (request) => {
    await requireSystemAdmin(request);
    return ok(await codexConnector.status(), { requestId: request.id });
  });
  app.post("/ai/connector/browser-login", async (request) => {
    await requireSystemAdmin(request);
    return ok(await codexConnector.browserLogin(), { requestId: request.id });
  });
  app.post("/ai/connector/device-login", async (request) => {
    await requireSystemAdmin(request);
    return ok(await codexConnector.deviceLogin(), { requestId: request.id });
  });
  app.post("/ai/connector/logout", async (request) => {
    await requireSystemAdmin(request);
    await codexConnector.logout();
    return ok({ disconnected: true }, { requestId: request.id });
  });
  app.get("/ai/skills", async (request) => {
    const context = identityContext(request);
    await requireSystemAdmin(request);
    const rows = await context.database
      .selectFrom("ai_honey_skills")
      .select(["name", "description", "instructions", "enabled"])
      .orderBy("name")
      .execute();
    return ok(
      rows.map((row) => ({ ...row, enabled: Boolean(row.enabled) })),
      { requestId: request.id }
    );
  });
  app.put("/ai/skills/:name", async (request) => {
    const context = identityContext(request);
    await requireSystemAdmin(request);
    const { name } = z.object({ name: z.string().min(1).max(80) }).parse(request.params);
    const input = z
      .object({
        description: z.string().min(10).max(500),
        instructions: z.string().min(10).max(10000),
        enabled: z.boolean()
      })
      .parse(request.body);
    await context.database
      .updateTable("ai_honey_skills")
      .set(input)
      .where("name", "=", name)
      .execute();
    return ok({ name, ...input }, { requestId: request.id });
  });
  registerContractRoute(app, {
    method: "GET",
    url: "/ai/honey/overview",
    schemas: { response: overview },
    handler: async ({ request }) => {
      await honeySettings(request).requireEnabled();
      return new HoneyService(identityContext(request)).overview();
    }
  });
  registerContractRoute(app, {
    method: "GET",
    url: "/ai/honey/conversations",
    schemas: {
      response: z.array(z.object({ id: z.uuid(), title: z.string(), updatedAt: z.coerce.date() }))
    },
    handler: async ({ request }) => {
      await honeySettings(request).requireEnabled();
      return new HoneyService(identityContext(request)).list();
    }
  });
  registerContractRoute(app, {
    method: "POST",
    url: "/ai/honey/conversations/:id/archive",
    schemas: { params, response: z.object({ archived: z.literal(true) }) },
    handler: async ({ params: value, request }) => {
      await honeySettings(request).requireEnabled();
      return new HoneyService(identityContext(request)).archive(value.id);
    }
  });
  registerContractRoute(app, {
    method: "GET",
    url: "/ai/honey/conversations/:id",
    schemas: { params, response: conversation },
    handler: async ({ params: value, request }) => {
      await honeySettings(request).requireEnabled();
      return new HoneyService(identityContext(request)).conversation(value.id);
    }
  });
  registerContractRoute(app, {
    method: "POST",
    url: "/ai/honey/chat",
    schemas: {
      body: z.object({
        message: z.string().trim().min(1).max(12000),
        mode: z.enum(["assistant", "content-writer"]).default("assistant"),
        threadId: z.uuid().nullable().optional()
      }),
      response: conversation
    },
    handler: async ({ body, request }) => {
      await honeySettings(request).requireEnabled();
      return new HoneyService(
        identityContext(request),
        new HoneyModelGateway({ logger: request.log, requestId: request.id })
      ).chat(body);
    }
  });
}

function honeySettings(request: Parameters<typeof identityContext>[0]) {
  return new HoneySettingsService(identityContext(request));
}

async function requireSystemAdmin(request: Parameters<typeof identityContext>[0]) {
  const actor = await identityContext(request).actorUser();
  if (!actor || actor.role !== "super-admin")
    throw AppError.forbidden("System administrator access is required.");
  return actor;
}
