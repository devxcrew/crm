import type { FastifyInstance } from "fastify";
import { registerContractRoute } from "@codexsun/framework/http";
import { z } from "zod";
import { identityContext } from "../../auth/identity-context.js";
import { getTechMediaDatabase } from "../../database/techmedia-database.js";
import { BrandingService } from "./branding.service.js";

const branding = z.object({
  tagline: z.string().trim().min(1).max(180).regex(/^[^\r\n]+$/u, "Tagline must be one line."),
  title: z.string().trim().min(1).max(80).regex(/^[^\r\n]+$/u, "Title must be one line.")
});

export function registerBrandingRoutes(app: FastifyInstance) {
  registerContractRoute(app, {
    method: "GET",
    url: "/app-branding",
    schemas: { response: branding },
    handler: () => new BrandingService({ database: getTechMediaDatabase() }).get()
  });
  registerContractRoute(app, {
    method: "PUT",
    url: "/app-branding",
    schemas: { body: branding, response: branding },
    handler: ({ body, request }) => new BrandingService(identityContext(request)).update(body)
  });
}
