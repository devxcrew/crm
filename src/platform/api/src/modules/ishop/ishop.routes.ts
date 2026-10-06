import type { FastifyInstance } from "fastify";
import { registerContractRoute } from "@codexsun/framework/http";
import { z } from "zod";
import { identityContext } from "../../auth/identity-context.js";
import { IshopService, type IshopPage } from "./ishop.service.js";
const page = z.enum(["catalogs", "categories", "brands", "products", "items", "variants", "images"]);
const record = z.record(z.string(), z.unknown());
export async function registerIshopRoutes(app: FastifyInstance) {
  registerContractRoute(app, { method: "GET", url: "/ishop/:page", schemas: { params: z.object({ page }), response: z.array(record) }, handler: ({ params, request }) => service(request).list(params.page as IshopPage) });
  registerContractRoute(app, { method: "POST", url: "/ishop/:page", schemas: { body: record, params: z.object({ page: z.enum(["catalogs", "items"]) }), response: record }, handler: ({ body, params, request }) => service(request).save(params.page, undefined, body) });
  registerContractRoute(app, { method: "PUT", url: "/ishop/:page/:name", schemas: { body: record, params: z.object({ name: z.string().trim().min(1), page: z.enum(["catalogs", "items"]) }), response: record }, handler: ({ body, params, request }) => service(request).save(params.page, params.name, body) });
}
function service(request: Parameters<typeof identityContext>[0]) { return new IshopService(identityContext(request)); }
