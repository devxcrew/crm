import { AppError } from "@codexsun/framework/errors";
import { frappeConnectionContract, frappeRequest } from "../frappe/index.js";
import type {
  Estimate,
  EstimateContext,
  EstimateReference,
  EstimateReferences,
  EstimateSavePayload
} from "./estimate.types.js";

const estimateFields = [
  "name",
  "enquiry",
  "date",
  "creation",
  "modified",
  "item_name",
  "supplier",
  "supplier.supplier_name",
  "price"
];

type FrappeEstimate = {
  creation?: string;
  date?: string;
  enquiry?: string;
  item_name?: string;
  modified?: string;
  name?: string;
  price?: number | string;
  supplier?: string;
  supplier_name?: string;
};

export class EstimateService {
  constructor(private readonly context: EstimateContext) {}

  async list(enquiry?: string): Promise<Estimate[]> {
    await this.context.authorize("estimate.view");
    const response = await frappeRequest<{ data?: FrappeEstimate[]; message?: FrappeEstimate[] }>(
      await this.connection(),
      "/api/v2/method/frappe.client.get_list",
      {
        body: JSON.stringify({
          doctype: "Estimate",
          fields: estimateFields,
          filters: enquiry ? [["enquiry", "=", requiredEnquiry(enquiry)]] : [],
          limit_page_length: 500,
          order_by: "modified desc"
        }),
        method: "POST"
      }
    );
    return records(response).map(toEstimate);
  }

  async get(name: string): Promise<Estimate> {
    await this.context.authorize("estimate.view");
    const response = await frappeRequest<{
      data?: FrappeEstimate;
      message?: FrappeEstimate;
    }>(
      await this.connection(),
      `/api/v2/document/Estimate/${encodeURIComponent(requiredName(name))}`
    );
    return toEstimate(response.data ?? response.message ?? {});
  }

  async references(): Promise<EstimateReferences> {
    await this.context.authorize("estimate.view");
    const connection = await this.connection();
    const [enquiries, suppliers] = await Promise.all([
      frappeRequest<{
        data?: Array<{ customer?: string; enquiry_details?: string; name?: string }>;
        message?: Array<{ customer?: string; enquiry_details?: string; name?: string }>;
      }>(connection, "/api/v2/method/frappe.client.get_list", {
        body: JSON.stringify({
          doctype: "Enquiry",
          fields: ["name", "enquiry_details", "customer"],
          filters: [],
          limit_page_length: 500,
          order_by: "modified desc"
        }),
        method: "POST"
      }),
      frappeRequest<{
        data?: Array<{ name?: string; supplier_name?: string }>;
        message?: Array<{ name?: string; supplier_name?: string }>;
      }>(connection, "/api/v2/method/frappe.client.get_list", {
        body: JSON.stringify({
          doctype: "Supplier",
          fields: ["name", "supplier_name"],
          filters: [],
          limit_page_length: 500,
          order_by: "supplier_name asc"
        }),
        method: "POST"
      })
    ]);
    return {
      enquiries: records(enquiries)
        .map((record) =>
          reference(
            record.name,
            [record.customer, record.enquiry_details].filter(Boolean).join(" · ")
          )
        )
        .filter((value): value is EstimateReference => Boolean(value)),
      suppliers: records(suppliers)
        .map((record) => reference(record.name, record.supplier_name))
        .filter((value): value is EstimateReference => Boolean(value))
    };
  }

  async create(input: EstimateSavePayload): Promise<Estimate> {
    await this.authorizeWrite("estimate.create", "crm.enquiry.create");
    const response = await frappeRequest<{
      data?: FrappeEstimate;
      message?: FrappeEstimate;
    }>(await this.connection(), "/api/v2/document/Estimate", {
      body: JSON.stringify(toFrappePayload(input)),
      method: "POST"
    });
    return toEstimate(response.data ?? response.message ?? {});
  }

  async update(name: string, input: EstimateSavePayload): Promise<Estimate> {
    await this.authorizeWrite("estimate.update", "crm.enquiry.update");
    const response = await frappeRequest<{
      data?: FrappeEstimate;
      message?: FrappeEstimate;
    }>(
      await this.connection(),
      `/api/v2/document/Estimate/${encodeURIComponent(requiredName(name))}`,
      {
        body: JSON.stringify(toFrappePayload(input)),
        method: "PUT"
      }
    );
    return toEstimate(response.data ?? response.message ?? {});
  }

  private async connection() {
    const actor = await this.context.actorUser();
    if (!actor) throw AppError.unauthorized("Active user is required.");
    const connection = await frappeConnectionContract({
      database: this.context.database,
      userId: actor.id
    }).get();
    if (!connection?.enabled) {
      throw AppError.conflict("Enable the Frappe connection before opening Estimate.");
    }
    if (!connection.authenticatedUser) {
      throw AppError.conflict(
        "This user's Frappe API credentials must be verified before opening Estimate."
      );
    }
    return connection;
  }

  private async authorizeWrite(estimatePermission: string, crmPermission: string) {
    if ((await this.context.can(estimatePermission)) || (await this.context.can(crmPermission))) {
      return;
    }
    await this.context.authorize(estimatePermission);
  }
}

function records<T>(response: { data?: T[]; message?: T[] }) {
  return response.message ?? response.data ?? [];
}

function reference(id: string | undefined, label: string | undefined) {
  const value = id?.trim();
  if (!value) return null;
  return { id: value, label: plainText(label) || value };
}

function plainText(value: string | undefined) {
  return (value ?? "")
    .replace(/<br\s*\/?\s*>/giu, " ")
    .replace(/<\/p\s*>/giu, " ")
    .replace(/<[^>]*>/gu, "")
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/\s+/gu, " ")
    .trim();
}

function requiredName(value: string) {
  const name = value.trim();
  if (!name) throw AppError.validation("Estimate name is required.");
  return name;
}

function requiredEnquiry(value: string) {
  const enquiry = value.trim();
  if (!enquiry) throw AppError.validation("Enquiry is required.");
  return enquiry;
}

function toFrappePayload(input: EstimateSavePayload) {
  return {
    date: input.date,
    enquiry: input.enquiry,
    item_name: input.itemName,
    price: input.price,
    supplier: input.supplier
  };
}

function toEstimate(record: FrappeEstimate): Estimate {
  const name = record.name?.trim();
  if (!name) {
    throw new AppError({
      code: "FRAPPE_ESTIMATE_INVALID",
      message: "Frappe returned an invalid Estimate record.",
      statusCode: 502
    });
  }
  return {
    createdAt: record.creation ?? "",
    date: record.date ?? "",
    enquiry: record.enquiry ?? "",
    itemName: record.item_name ?? "",
    modifiedAt: record.modified ?? "",
    name,
    price: Number(record.price ?? 0),
    supplier: record.supplier ?? "",
    supplierName: record.supplier_name ?? record.supplier ?? ""
  };
}
