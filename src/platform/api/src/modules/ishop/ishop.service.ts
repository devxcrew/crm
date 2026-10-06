import { AppError } from "@codexsun/framework/errors";
import { frappeConnectionContract, frappeRequest } from "../frappe/index.js";
import type { IshopContext } from "./ishop.types.js";

const definitions = {
  brands: { doctype: "Brand", fields: ["name", "brand", "modified"] },
  catalogs: { doctype: "iShop Catalog", fields: ["name", "catalog_code", "catalog_name", "description", "catalog_image", "published", "modified"] },
  categories: { doctype: "Item Group", fields: ["name", "item_group_name", "parent_item_group", "is_group", "modified"] },
  images: { doctype: "iShop Item", fields: ["name", "item_code", "item_name", "image", "published", "modified"] },
  items: { doctype: "iShop Item", fields: ["name", "item_code", "item_name", "availability", "item_group", "brand", "short_description", "web_price", "mrp", "image", "highlights", "published", "modified"] },
  products: { doctype: "Item", fields: ["name", "item_code", "item_name", "item_group", "brand", "image", "standard_rate", "disabled", "variant_of", "modified"] },
  variants: { doctype: "Item", fields: ["name", "item_code", "item_name", "variant_of", "item_group", "brand", "image", "standard_rate", "disabled", "modified"] }
} as const;
export type IshopPage = keyof typeof definitions;

export class IshopService {
  constructor(private readonly context: IshopContext) {}
  async list(page: IshopPage) {
    await this.context.authorize("ishop.view");
    const definition = definitions[page];
    const response = await frappeRequest<{ data?: Array<Record<string, unknown>>; message?: Array<Record<string, unknown>> }>(await this.connection(), "/api/v2/method/frappe.client.get_list", { body: JSON.stringify({ doctype: definition.doctype, fields: definition.fields, filters: page === "variants" ? [["variant_of", "is", "set"]] : [], limit_page_length: 500, order_by: "modified desc" }), method: "POST" });
    return response.message ?? response.data ?? [];
  }
  async save(page: "catalogs" | "items", name: string | undefined, value: Record<string, unknown>) {
    await this.context.authorize("ishop.manage");
    const connection = await this.connection();
    const path = name ? `/api/v2/document/${encodeURIComponent(definitions[page].doctype)}/${encodeURIComponent(name)}` : `/api/v2/document/${encodeURIComponent(definitions[page].doctype)}`;
    const response = await frappeRequest<{ data?: Record<string, unknown>; message?: Record<string, unknown> }>(connection, path, { body: JSON.stringify(value), method: name ? "PUT" : "POST" });
    return response.data ?? response.message ?? {};
  }
  private async connection() {
    const actor = await this.context.actorUser();
    if (!actor) throw AppError.unauthorized("Active user is required.");
    const connection = await frappeConnectionContract({ database: this.context.database, userId: actor.id }).get();
    if (!connection?.enabled) throw AppError.conflict("Enable the Frappe connection before opening iShop.");
    if (!connection.authenticatedUser) throw AppError.conflict("This user's Frappe API credentials must be verified before opening iShop.");
    return connection;
  }
}
