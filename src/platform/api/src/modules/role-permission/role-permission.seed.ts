import { createHash } from "node:crypto";
import { sql, type Kysely } from "kysely";
import type { TechMediaDatabase } from "../../database/schema.js";

export async function seedRolePermissionModule(database: Kysely<TechMediaDatabase>) {
  const superAdmin = await database
    .selectFrom("roles")
    .select("id")
    .where("key", "=", "super-admin")
    .where("status", "=", "active")
    .executeTakeFirst();
  if (!superAdmin) return;
  const permissions = await database.selectFrom("permissions").select("id").execute();
  for (const permission of permissions) {
    await sql`INSERT INTO role_permissions (uuid,role_id,permission_id,status,is_protected)
      VALUES (${stable(`role-permission:${superAdmin.id}:${permission.id}`)},${superAdmin.id},${permission.id},'active',TRUE)
      ON DUPLICATE KEY UPDATE status='active',is_protected=TRUE`.execute(database);
  }
  await sql`DELETE rp FROM role_permissions rp
    INNER JOIN roles r ON r.id=rp.role_id
    INNER JOIN permissions p ON p.id=rp.permission_id
    WHERE r.\`key\` IN ('admin','user')
      AND (p.\`key\` LIKE 'identity.%' OR p.\`key\` LIKE 'settings.%')`.execute(database);

  const liveFrappeDefaults: Record<string, string[]> = {
    admin: [
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
      "crm.enquiry.create",
      "crm.enquiry.update",
      "crm.enquiry.assign",
      "crm.enquiry.force-delete",
      "crm.job.manage",
      "crm.report.view",
      "estimate.view",
      "estimate.create",
      "estimate.update",
      "quotation.view",
      "quotation.create",
      "quotation.update",
      "ishop.view",
      "ishop.manage"
    ],
    user: [
      "hr.request.own.view",
      "hr.request.create",
      "hr.request.own.update",
      "crm.enquiry.mobile.lookup"
    ]
  };
  for (const [roleKey, permissionKeys] of Object.entries(liveFrappeDefaults)) {
    const role = await database
      .selectFrom("roles")
      .select("id")
      .where("key", "=", roleKey)
      .where("status", "=", "active")
      .executeTakeFirst();
    if (!role) continue;
    const rolePermissions = await database
      .selectFrom("permissions")
      .select("id")
      .where("key", "in", permissionKeys)
      .execute();
    for (const permission of rolePermissions) {
      await sql`INSERT INTO role_permissions (uuid,role_id,permission_id,status,is_protected)
      VALUES (${stable(`role-permission:${role.id}:${permission.id}`)},${role.id},${permission.id},'active',FALSE)
        ON DUPLICATE KEY UPDATE is_protected=FALSE`.execute(database);
    }
  }
}

function stable(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 8);
}
