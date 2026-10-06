import { createHash } from "node:crypto";
import type { Kysely } from "kysely";
import type { TechMediaDatabase } from "../../database/schema.js";

const permissionKeys = [
  "identity.user.view",
  "identity.user.create",
  "identity.user.update",
  "identity.user.suspend",
  "identity.user.delete",
  "identity.role.view",
  "identity.role.create",
  "identity.role.update",
  "identity.role.suspend",
  "identity.role.delete",
  "identity.permission.view",
  "identity.permission.create",
  "identity.permission.update",
  "identity.permission.suspend",
  "identity.permission.delete",
  "identity.user-role.view",
  "identity.user-role.assign",
  "identity.user-role.update",
  "identity.user-role.remove",
  "identity.role-permission.view",
  "identity.role-permission.assign",
  "identity.role-permission.update",
  "identity.role-permission.remove",
  "settings.frappe.view",
  "settings.frappe.update",
  "hr.request.own.view",
  "hr.request.create",
  "hr.request.own.update",
  "hr.request.all.view",
  "hr.request.approve",
  "crm.enquiry.assigned.view",
  "crm.enquiry.created.view",
  "crm.enquiry.open.view",
  "crm.enquiry.all.view",
  "crm.enquiry.mobile.lookup",
  "crm.report.view",
  "crm.enquiry.create",
  "crm.enquiry.update",
  "crm.enquiry.assign",
  "crm.enquiry.force-delete",
  "crm.job.manage",
  "estimate.view",
  "estimate.create",
  "estimate.update",
  "quotation.view",
  "quotation.create",
  "quotation.update",
  "ishop.view",
  "ishop.manage"
] as const;

export async function seedPermissionModule(database: Kysely<TechMediaDatabase>) {
  for (const key of permissionKeys) {
    const label = key
      .split(".")
      .map((part) => part.replaceAll("-", " "))
      .join(" · ");
    await database
      .insertInto("permissions")
      .values({
        description: `Allows ${label.toLowerCase()} in CRM.`,
        is_protected: true,
        key,
        label,
        status: "active",
        uuid: stable(key)
      })
      .onDuplicateKeyUpdate({
        description: `Allows ${label.toLowerCase()} in CRM.`,
        is_protected: true,
        label,
        status: "active"
      })
      .execute();
  }
}

function stable(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 8);
}
