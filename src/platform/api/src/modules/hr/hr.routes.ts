import type { FastifyInstance } from "fastify";
import { registerContractRoute } from "@codexsun/framework/http";
import { z } from "zod";
import { identityContext } from "../../auth/identity-context.js";
import type { PlatformModuleDependencies } from "../../module-dependencies.js";
import { HrService } from "./hr.service.js";

const path = "/hr/requests";
const params = z.object({ name: z.string().trim().min(1).max(255) });
const listQuery = z.object({ view: z.enum(["all", "my"]) });
const payload = z
  .object({
    date: z.iso.date(),
    days: z.number().int().min(1).max(365),
    details: z.string().trim().min(1).max(4_000),
    requestType: z.string().trim().min(1).max(140)
  })
  .strict();
const approval = z.object({
  approvedAt: z.iso.datetime(),
  approvedBy: z.string(),
  comment: z.string()
});
const record = z.object({
  approvals: z.array(approval),
  createdAt: z.iso.datetime(),
  date: z.iso.date(),
  days: z.number().int().min(0),
  details: z.string(),
  employee: z.string(),
  modifiedAt: z.iso.datetime(),
  name: z.string(),
  requestType: z.string()
});
const duty = z.object({
  department: z.string(),
  frequency: z.enum(["Daily", "Weekly", "Monthly", "Yearly"]),
  index: z.number().int(),
  reports: z.array(
    z.object({
      actions: z.string(),
      createdAt: z.iso.datetime(),
      date: z.iso.date(),
      name: z.string()
    })
  ),
  sopItem: z.string(),
  sopName: z.string(),
  steps: z.string()
});
const dutyParams = z.object({ sopItem: z.string().trim().min(1).max(255) });
const dutyReportPayload = z.object({ actions: z.string().trim().min(1).max(4000) }).strict();

export async function registerHrRoutes(
  app: FastifyInstance,
  frappeLiveStaffRequestGateway: PlatformModuleDependencies["frappeLiveStaffRequestGateway"],
  frappeLiveSopDutyGateway: PlatformModuleDependencies["frappeLiveSopDutyGateway"]
) {
  registerContractRoute(app, {
    method: "GET",
    url: "/mobile/hr/duties",
    schemas: { response: z.array(duty) },
    handler: async ({ request }) =>
      (await service(request, frappeLiveStaffRequestGateway, frappeLiveSopDutyGateway)).duties()
  });
  registerContractRoute(app, {
    method: "GET",
    url: "/hr/duties",
    schemas: { response: z.array(duty) },
    handler: async ({ request }) =>
      (await service(request, frappeLiveStaffRequestGateway, frappeLiveSopDutyGateway)).duties()
  });
  registerContractRoute(app, {
    method: "POST",
    url: "/mobile/hr/duties/:sopItem/reports",
    schemas: { body: dutyReportPayload, params: dutyParams, response: duty },
    handler: async ({ body, params: value, request }) =>
      (await service(request, frappeLiveStaffRequestGateway, frappeLiveSopDutyGateway)).reportDuty(
        value.sopItem,
        body.actions
      )
  });
  registerContractRoute(app, {
    method: "POST",
    url: "/hr/duties/:sopItem/reports",
    schemas: { body: dutyReportPayload, params: dutyParams, response: duty },
    handler: async ({ body, params: value, request }) =>
      (await service(request, frappeLiveStaffRequestGateway, frappeLiveSopDutyGateway)).reportDuty(
        value.sopItem,
        body.actions
      )
  });
  registerContractRoute(app, {
    method: "GET",
    url: path,
    schemas: { querystring: listQuery, response: z.array(record) },
    handler: async ({ query, request }) =>
      (await service(request, frappeLiveStaffRequestGateway, frappeLiveSopDutyGateway)).list(
        query.view
      )
  });
  registerContractRoute(app, {
    method: "GET",
    url: `${path}/:name`,
    schemas: { params, response: record },
    handler: async ({ params: value, request }) =>
      (await service(request, frappeLiveStaffRequestGateway, frappeLiveSopDutyGateway)).get(
        value.name
      )
  });
  registerContractRoute(app, {
    method: "POST",
    url: path,
    schemas: { body: payload, response: record },
    handler: async ({ body, request }) =>
      (await service(request, frappeLiveStaffRequestGateway, frappeLiveSopDutyGateway)).create(body)
  });
  registerContractRoute(app, {
    method: "PUT",
    url: `${path}/:name`,
    schemas: { body: payload, params, response: record },
    handler: async ({ body, params: value, request }) =>
      (await service(request, frappeLiveStaffRequestGateway, frappeLiveSopDutyGateway)).update(
        value.name,
        body
      )
  });
  registerContractRoute(app, {
    method: "POST",
    url: `${path}/:name/approve`,
    schemas: { params, response: record },
    handler: async ({ params: value, request }) =>
      (await service(request, frappeLiveStaffRequestGateway, frappeLiveSopDutyGateway)).approve(
        value.name
      )
  });
}

async function service(
  request: Parameters<typeof identityContext>[0],
  gateway: PlatformModuleDependencies["frappeLiveStaffRequestGateway"],
  sopDutyGateway: PlatformModuleDependencies["frappeLiveSopDutyGateway"]
) {
  const context = identityContext(request);
  const actor = await context.actorUser();
  if (!actor) throw new Error("Active user is required.");
  return new HrService(
    context,
    gateway({
      database: context.database,
      employee: context.frappeEmployeeCode,
      userId: actor.id
    }),
    sopDutyGateway({
      database: context.database,
      employee: context.frappeEmployeeCode,
      userId: actor.id
    })
  );
}
