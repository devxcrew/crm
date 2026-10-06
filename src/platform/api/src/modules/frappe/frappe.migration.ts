import { sql, type Kysely } from "kysely";
import type { TechMediaDatabase } from "../../database/schema.js";

export const frappeMigration = { key: "settings.frappe.connection-v1" } as const;

export async function migrateFrappeModule(database: Kysely<TechMediaDatabase>) {
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS frappe_connection_settings (
        id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
        connection_name VARCHAR(160) NOT NULL,
        base_url VARCHAR(500) NOT NULL,
        api_key_ciphertext LONGTEXT NULL,
        api_secret_ciphertext LONGTEXT NULL,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        verification_status VARCHAR(24) NOT NULL DEFAULT 'unverified',
        last_checked_at DATETIME NULL,
        last_verified_at DATETIME NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);
  await database.insertInto("schema_migrations").ignore().values({ name: frappeMigration.key }).execute();
}
