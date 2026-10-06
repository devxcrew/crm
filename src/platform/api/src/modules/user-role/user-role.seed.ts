import { createHash } from "node:crypto";
import { sql, type Kysely } from "kysely";
import type { TechMediaDatabase } from "../../database/schema.js";

export async function seedUserRoleModule(database: Kysely<TechMediaDatabase>) {
  await sql`DELETE ur FROM user_roles ur
    INNER JOIN users u ON u.id=ur.user_id
    INNER JOIN roles selected_role ON selected_role.\`key\`=u.role
    WHERE ur.role_id<>selected_role.id`.execute(database);

  const users = await database
    .selectFrom("users")
    .select(["id", "role", "is_protected"])
    .where("status", "=", "active")
    .execute();
  for (const user of users) {
    const role = await database
      .selectFrom("roles")
      .select("id")
      .where("key", "=", user.role)
      .where("status", "=", "active")
      .executeTakeFirst();
    if (!role) continue;
    await sql`INSERT INTO user_roles (uuid,user_id,role_id,status,is_protected)
      VALUES (${stable(`user-role:${user.id}:${role.id}`)},${user.id},${role.id},'active',${Boolean(user.is_protected)})
      ON DUPLICATE KEY UPDATE status='active',is_protected=VALUES(is_protected)`.execute(database);
  }
}

function stable(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 8);
}
