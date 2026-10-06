import type { FastifyInstance } from "fastify";
import { registerContractRoute } from "@codexsun/framework/http";
import { z } from "zod";
import { identityContext } from "../../auth/identity-context.js";
import { QuotationService } from "./quotation.service.js";

const path = "/quotations";
const params = z.object({ name: z.string().trim().min(1).max(255) });
const query = z.object({ enquiry: z.string().trim().min(1).max(255) });
const positiveAmount = (label: string) =>
  z
    .string()
    .trim()
    .regex(/^\d+(?:\.\d{1,2})?$/u, `${label} must be a positive number with up to 2 decimals.`)
    .refine((value) => Number(value) > 0, `${label} must be greater than zero.`);
const payload = z
  .object({
    company: z.string().trim().min(1).max(255),
    itemCode: z.string().trim().min(1).max(255),
    quantity: positiveAmount("Quantity"),
    rate: positiveAmount("Rate"),
    remarks: z.string().trim().max(1000),
    transactionDate: z.iso.date(),
    validTill: z.union([z.iso.date(), z.literal("")])
  })
  .strict();
const item = z.object({
  amount: z.number().finite(),
  itemCode: z.string(),
  itemName: z.string(),
  name: z.string(),
  quantity: z.number().finite(),
  rate: z.number().finite(),
  unit: z.string()
});
const record = z.object({
  company: z.string(),
  createdAt: z.string(),
  currency: z.string(),
  customer: z.string(),
  customerName: z.string(),
  enquiry: z.string(),
  grandTotal: z.number().finite(),
  items: z.array(item),
  modifiedAt: z.string(),
  name: z.string(),
  owner: z.string(),
  remarks: z.string(),
  status: z.string(),
  transactionDate: z.iso.date(),
  validTill: z.string()
});
const reference = z.object({ id: z.string(), label: z.string() });
const references = z.object({
  companies: z.array(reference),
  items: z.array(reference)
});

export async function registerQuotationRoutes(app: FastifyInstance) {
  registerContractRoute(app, {
    method: "GET",
    url: path,
    schemas: { querystring: query, response: z.array(record) },
    handler: ({ query: value, request }) => service(request).list(value.enquiry)
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
    schemas: { params, querystring: query, response: record },
    handler: ({ params: value, query: filter, request }) =>
      service(request).get(value.name, filter.enquiry)
  });
  registerContractRoute(app, {
    method: "POST",
    url: path,
    schemas: { body: payload, querystring: query, response: record },
    handler: ({ body, query: filter, request }) => service(request).create(filter.enquiry, body)
  });
  registerContractRoute(app, {
    method: "PUT",
    url: `${path}/:name`,
    schemas: { body: payload, params, querystring: query, response: record },
    handler: ({ body, params: value, query: filter, request }) =>
      service(request).update(value.name, filter.enquiry, body)
  });
}

function service(request: Parameters<typeof identityContext>[0]) {
  return new QuotationService(identityContext(request));
}
