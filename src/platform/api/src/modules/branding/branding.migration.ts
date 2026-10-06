import { sql, type Kysely } from "kysely";
import type { TechMediaDatabase } from "../../database/schema.js";

export const brandingMigrations = [{ key: "app.branding.settings-v1" }] as const;

export async function migrateBrandingModule(database: Kysely<TechMediaDatabase>) {
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS app_branding_settings (
        id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
        title VARCHAR(80) NOT NULL,
        tagline VARCHAR(180) NOT NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);
  await database
    .insertInto("schema_migrations")
    .ignore()
    .values(brandingMigrations.map(({ key }) => ({ name: key })))
    .execute();
}
