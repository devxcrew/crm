import type { Kysely } from "kysely";
import { env } from "../../env.js";
import type { TechMediaDatabase } from "../../database/schema.js";

export async function seedBrandingModule(database: Kysely<TechMediaDatabase>) {
  await database
    .insertInto("app_branding_settings")
    .ignore()
    .values({ id: 1, tagline: env.APP_BRAND_TAGLINE, title: env.APP_BRAND_NAME })
    .execute();
}
