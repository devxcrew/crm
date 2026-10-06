import { AppError } from "@codexsun/framework/errors";
import { frappeConnectionContract, frappeRequest } from "../frappe/index.js";
import type {
  Quotation,
  QuotationContext,
  QuotationItem,
  QuotationReference,
  QuotationReferences,
  QuotationSavePayload
} from "./quotation.types.js";

const enquiryField = "custom_enquiry";
const quotationFields = [
  "name",
  enquiryField,
  "transaction_date",
  "valid_till",
  "company",
  "party_name",
  "customer_name",
  "currency",
  "grand_total",
  "status",
  "owner",
  "custom_remarks",
  "creation",
  "modified"
];

type FrappeQuotationItem = {
  amount?: number | string;
  item_code?: string;
  item_name?: string;
  name?: string;
  qty?: number | string;
  rate?: number | string;
  uom?: string;
};

type FrappeQuotation = {
  company?: string;
  creation?: string;
  currency?: string;
  custom_enquiry?: string;
  custom_remarks?: string;
  customer_name?: string;
  grand_total?: number | string;
  items?: FrappeQuotationItem[];
  modified?: string;
  name?: string;
  owner?: string;
  party_name?: string;
  status?: string;
  transaction_date?: string;
  valid_till?: string;
};

export class QuotationService {
  constructor(private readonly context: QuotationContext) {}

  async list(enquiry: string): Promise<Quotation[]> {
    await this.context.authorize("quotation.view");
    const response = await frappeRequest<{
      data?: FrappeQuotation[];
      message?: FrappeQuotation[];
    }>(await this.connection(), "/api/v2/method/frappe.client.get_list", {
      body: JSON.stringify({
        doctype: "Quotation",
        fields: quotationFields,
        filters: [[enquiryField, "=", requiredEnquiry(enquiry)]],
        limit_page_length: 500,
        order_by: "modified desc"
      }),
      method: "POST"
    });
    return records(response).map(toQuotation);
  }

  async get(name: string, enquiry: string): Promise<Quotation> {
    await this.context.authorize("quotation.view");
    const record = await this.document(requiredName(name));
    assertEnquiry(record, enquiry);
    return toQuotation(record);
  }

  async references(): Promise<QuotationReferences> {
    await this.context.authorize("quotation.view");
    const connection = await this.connection();
    const [companies, items] = await Promise.all([
      frappeRequest<{
        data?: Array<{ name?: string }>;
        message?: Array<{ name?: string }>;
      }>(connection, "/api/v2/method/frappe.client.get_list", {
        body: JSON.stringify({
          doctype: "Company",
          fields: ["name"],
          filters: [],
          limit_page_length: 100,
          order_by: "name asc"
        }),
        method: "POST"
      }),
      frappeRequest<{
        data?: Array<{ item_name?: string; name?: string; stock_uom?: string }>;
        message?: Array<{ item_name?: string; name?: string; stock_uom?: string }>;
      }>(connection, "/api/v2/method/frappe.client.get_list", {
        body: JSON.stringify({
          doctype: "Item",
          fields: ["name", "item_name", "stock_uom"],
          filters: [
            ["disabled", "=", 0],
            ["is_sales_item", "=", 1]
          ],
          limit_page_length: 500,
          order_by: "item_name asc"
        }),
        method: "POST"
      })
    ]);
    return {
      companies: records(companies)
        .map((record) => reference(record.name, record.name))
        .filter((value): value is QuotationReference => Boolean(value)),
      items: records(items)
        .map((record) =>
          reference(record.name, [record.item_name, record.stock_uom].filter(Boolean).join(" · "))
        )
        .filter((value): value is QuotationReference => Boolean(value))
    };
  }

  async create(enquiry: string, input: QuotationSavePayload): Promise<Quotation> {
    await this.authorizeWrite("quotation.create", "crm.enquiry.create");
    const enquiryName = requiredEnquiry(enquiry);
    const customer = await this.enquiryCustomer(enquiryName);
    const response = await frappeRequest<{
      data?: FrappeQuotation;
      message?: FrappeQuotation;
    }>(await this.connection(), "/api/v2/document/Quotation", {
      body: JSON.stringify(toFrappePayload(enquiryName, customer, input)),
      method: "POST"
    });
    return toQuotation(response.data ?? response.message ?? {});
  }

  async update(name: string, enquiry: string, input: QuotationSavePayload): Promise<Quotation> {
    await this.authorizeWrite("quotation.update", "crm.enquiry.update");
    const quotationName = requiredName(name);
    const enquiryName = requiredEnquiry(enquiry);
    const existing = await this.document(quotationName);
    assertEnquiry(existing, enquiryName);
    const customer = await this.enquiryCustomer(enquiryName);
    const response = await frappeRequest<{
      data?: FrappeQuotation;
      message?: FrappeQuotation;
    }>(await this.connection(), `/api/v2/document/Quotation/${encodeURIComponent(quotationName)}`, {
      body: JSON.stringify(
        toFrappePayload(enquiryName, customer, input, existing.items?.[0]?.name)
      ),
      method: "PUT"
    });
    return toQuotation(response.data ?? response.message ?? {});
  }

  private async document(name: string) {
    const response = await frappeRequest<{
      data?: FrappeQuotation;
      message?: FrappeQuotation;
    }>(
      await this.connection(),
      `/api/v2/document/Quotation/${encodeURIComponent(requiredName(name))}`
    );
    return response.data ?? response.message ?? {};
  }

  private async enquiryCustomer(enquiry: string) {
    const response = await frappeRequest<{
      data?: { customer?: string };
      message?: { customer?: string };
    }>(
      await this.connection(),
      `/api/v2/document/Enquiry/${encodeURIComponent(requiredEnquiry(enquiry))}`
    );
    const customer = (response.data ?? response.message)?.customer?.trim();
    if (!customer) {
      throw AppError.conflict(
        "Add a Customer to this enquiry before creating or updating a quotation."
      );
    }
    return customer;
  }

  private async connection() {
    const actor = await this.context.actorUser();
    if (!actor) throw AppError.unauthorized("Active user is required.");
    const connection = await frappeConnectionContract({
      database: this.context.database,
      userId: actor.id
    }).get();
    if (!connection?.enabled) {
      throw AppError.conflict("Enable the Frappe connection before opening Quotation.");
    }
    if (!connection.authenticatedUser) {
      throw AppError.conflict(
        "This user's Frappe API credentials must be verified before opening Quotation."
      );
    }
    return connection;
  }

  private async authorizeWrite(quotationPermission: string, crmPermission: string) {
    if ((await this.context.can(quotationPermission)) || (await this.context.can(crmPermission))) {
      return;
    }
    await this.context.authorize(quotationPermission);
  }
}

function records<T>(response: { data?: T[]; message?: T[] }) {
  return response.message ?? response.data ?? [];
}

function reference(id: string | undefined, label: string | undefined) {
  const value = id?.trim();
  if (!value) return null;
  return { id: value, label: label?.trim() || value };
}

function requiredEnquiry(value: string) {
  const enquiry = value.trim();
  if (!enquiry) throw AppError.validation("Enquiry is required.");
  return enquiry;
}

function requiredName(value: string) {
  const name = value.trim();
  if (!name) throw AppError.validation("Quotation name is required.");
  return name;
}

function assertEnquiry(record: FrappeQuotation, enquiry: string) {
  if ((record.custom_enquiry ?? "").trim() !== requiredEnquiry(enquiry)) {
    throw AppError.notFound("Quotation was not found for this enquiry.");
  }
}

function toFrappePayload(
  enquiry: string,
  customer: string,
  input: QuotationSavePayload,
  itemName?: string
) {
  return {
    company: input.company,
    custom_enquiry: enquiry,
    custom_remarks: input.remarks || null,
    items: [
      {
        ...(itemName ? { name: itemName } : {}),
        item_code: input.itemCode,
        qty: Number(input.quantity),
        rate: Number(input.rate)
      }
    ],
    order_type: "Sales",
    party_name: customer,
    quotation_to: "Customer",
    transaction_date: input.transactionDate,
    valid_till: input.validTill || null
  };
}

function toQuotation(record: FrappeQuotation): Quotation {
  const name = record.name?.trim();
  if (!name) {
    throw new AppError({
      code: "FRAPPE_QUOTATION_INVALID",
      message: "Frappe returned an invalid Quotation record.",
      statusCode: 502
    });
  }
  return {
    company: record.company ?? "",
    createdAt: record.creation ?? "",
    currency: record.currency ?? "",
    customer: record.party_name ?? "",
    customerName: record.customer_name ?? record.party_name ?? "",
    enquiry: record.custom_enquiry ?? "",
    grandTotal: Number(record.grand_total ?? 0),
    items: (record.items ?? []).map(toQuotationItem),
    modifiedAt: record.modified ?? "",
    name,
    owner: record.owner ?? "",
    remarks: record.custom_remarks ?? "",
    status: record.status ?? "",
    transactionDate: record.transaction_date ?? "",
    validTill: record.valid_till ?? ""
  };
}

function toQuotationItem(record: FrappeQuotationItem): QuotationItem {
  return {
    amount: Number(record.amount ?? 0),
    itemCode: record.item_code ?? "",
    itemName: record.item_name ?? record.item_code ?? "",
    name: record.name ?? "",
    quantity: Number(record.qty ?? 0),
    rate: Number(record.rate ?? 0),
    unit: record.uom ?? ""
  };
}
