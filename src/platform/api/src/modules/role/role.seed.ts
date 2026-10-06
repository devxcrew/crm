import { createHash } from "node:crypto";
import { sql } from "kysely";
import type { Kysely } from "kysely";
import type { TechMediaDatabase } from "../../database/schema.js";

const roles = [
  {
    description: "Protected application administration. CRM is unavailable without an employee code.",
    key: "super-admin",
    label: "SuperAdmin",
    protected: true
  },
  {
    description: "Full CRM and account access.",
    key: "admin",
    label: "Admin",
    protected: true
  },
  {
    description: "CRM features selected by SuperAdmin.",
    key: "user",
    label: "User",
    protected: false
  }
] as const;

export async function seedRoleModule(database: Kysely<TechMediaDatabase>) {
  for (const role of roles) {
    await database
      .insertInto("roles")
      .values({
        description: role.description,
        is_protected: role.protected,
        key: role.key,
        label: role.label,
        status: "active",
        uuid: stable(`role:${role.key}`)
      })
      .onDuplicateKeyUpdate({
        description: role.description,
        is_protected: role.protected,
        label: role.label,
        status: "active"
      })
      .execute();
  }
  await sql`UPDATE users SET role='super-admin' WHERE id=1`.execute(database);
  await sql`UPDATE users SET role='user' WHERE id<>1 AND role NOT IN ('admin','user')`.execute(
    database
  );
  await sql`DELETE ur FROM user_roles ur INNER JOIN roles r ON r.id=ur.role_id
    WHERE r.\`key\` NOT IN ('super-admin','admin','user')`.execute(database);
  await sql`DELETE rp FROM role_permissions rp INNER JOIN roles r ON r.id=rp.role_id
    WHERE r.\`key\` NOT IN ('super-admin','admin','user')`.execute(database);
  await sql`DELETE FROM roles WHERE \`key\` NOT IN ('super-admin','admin','user')`.execute(database);
}

function stable(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 8);
}
