import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const databaseFile = "src/platform/api/src/database/techmedia-database.ts";
const schemaFile = "src/platform/api/src/database/schema.ts";
const database = readFileSync(resolve(root, databaseFile), "utf8");
const schema = readFileSync(resolve(root, schemaFile), "utf8");

assertOrdered(databaseFile, database, [
  "migrateRoleModule(db)",
  "migratePermissionModule(db)",
  "migrateUserModule(db)",
  "migrateUserRoleModule(db)",
  "migrateRolePermissionModule(db)",
  "migrateNotificationModule(db)",
  "migrateBrandingModule(db)",
  "migrateHoneyModule(db)",
  "migrateMessagingModule(db)"
]);
assertOrdered(databaseFile, database, [
  "seedRoleModule(db)",
  "seedPermissionModule(db)",
  "seedUserModule(db)",
  "seedUserRoleModule(db)",
  "seedRolePermissionModule(db)",
  "seedBrandingModule(db)"
]);

const expectedTables = [
  "ai_honey_messages",
  "ai_honey_settings",
  "ai_honey_skills",
  "ai_honey_threads",
  "app_branding_settings",
  "conversation_members",
  "conversations",
  "message_reactions",
  "message_receipts",
  "messages",
  "notification_device_tokens",
  "notification_outbox",
  "notifications",
  "permissions",
  "role_permissions",
  "roles",
  "schema_migrations",
  "user_roles",
  "users"
];
const declaredTables = Array.from(
  schema.matchAll(/^  ([a-z_]+): [A-Za-z]+Table;$/gmu),
  (match) => match[1]
).sort();
if (declaredTables.join(",") !== expectedTables.join(",")) {
  throw new Error(`${schemaFile}: unexpected table ownership: ${declaredTables.join(", ")}`);
}
if (!database.includes("techMediaDatabaseName()")) {
  throw new Error(`${databaseFile}: single database selection is missing`);
}
console.info(
  "Database lifecycle verified: one database with Identity, notifications, actor-owned Honey tables, and messaging."
);

function assertOrdered(file, source, tokens) {
  let previous = -1;
  for (const token of tokens) {
    const index = source.indexOf(token, previous + 1);
    if (index < 0) throw new Error(`${file}: missing ${token}`);
    if (index <= previous) throw new Error(`${file}: out of order ${token}`);
    previous = index;
  }
}
