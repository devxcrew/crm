import type { FastifyInstance } from "fastify";
import { registerContractRoute } from "@codexsun/framework/http";
import { z } from "zod";
import { identityContext } from "../../auth/identity-context.js";
import { EstimateService } from "./estimate.service.js";

const path = "/estimates";
const params = z.object({ name: z.string().trim().min(1).max(255) });
const listQuery = z.object({ enquiry: z.string().trim().min(1).max(255).optional() });
const price = z
  .string()
  .trim()
  .regex(/^\d+(?:\.\d{1,2})?$/u, "Price must be a positive amount with up to 2 decimals.")
  .refine((value) => Number(value) > 0, "Price must be greater than zero.");
const payload = z
  .object({
    date: z.iso.date(),
    enquiry: z.string().trim().min(1).max(255),
    itemName: z.string().trim().min(1).max(255),
    price,
    supplier: z.string().trim().min(1).max(255)
  })
  .strict();
const record = z.object({
  createdAt: z.string(),
  date: z.iso.date(),
  enquiry: z.string(),
  itemName: z.string(),
  modifiedAt: z.string(),
  name: z.string(),
  price: z.number().finite(),
  supplier: z.string(),
  supplierName: z.string()
});
const reference = z.object({ id: z.string(), label: z.string() });
const references = z.object({
  enquiries: z.array(reference),
  suppliers: z.array(reference)
});

export async function registerEstimateRoutes(app: FastifyInstance) {
  registerContractRoute(app, {
    method: "GET",
    url: path,
    schemas: { querystring: listQuery, response: z.array(record) },
    handler: ({ query, request }) => service(request).list(query.enquiry)
  });
  registerContractRoute(app, {
    method: "GET",
    url: `${path}/references`,
    schemas: { response: references },
    handler: ({ request }) => service(request).references()
  });
  registerContractRoute(app, {
    method: "GET",
    url: `${path}/:name`,
    schemas: { params, response: record },
    handler: ({ params: value, request }) => service(request).get(value.name)
  });
  registerContractRoute(app, {
    method: "POST",
    url: path,
    schemas: { body: payload, response: record },
    handler: ({ body, request }) => service(request).create(body)
  });
  registerContractRoute(app, {
    method: "PUT",
    url: `${path}/:name`,
    schemas: { body: payload, params, response: record },
    handler: ({ body, params: value, request }) => service(request).update(value.name, body)
  });
}

function service(request: Parameters<typeof identityContext>[0]) {
  return new EstimateService(identityContext(request));
}
