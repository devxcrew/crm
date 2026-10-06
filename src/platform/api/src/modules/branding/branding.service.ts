import { AppError } from "@codexsun/framework/errors";
import type { Kysely } from "kysely";
import type { TechMediaDatabase } from "../../database/schema.js";
import { updateBrandingEnvironment } from "./branding.env-store.js";

export type AppBrandingInput = { tagline: string; title: string };
type BrandingContext = {
  actorUser?: () => Promise<{ role: string } | undefined>;
  database: Kysely<TechMediaDatabase>;
  persistEnvironment?: (input: AppBrandingInput) => Promise<void>;
};

export class BrandingService {
  constructor(private readonly context: BrandingContext) {}

  async get() {
    return this.context.database
      .selectFrom("app_branding_settings")
      .select(["tagline", "title"])
      .where("id", "=", 1)
      .executeTakeFirstOrThrow();
  }

  async update(input: AppBrandingInput) {
    const actor = await this.context.actorUser?.();
    if (!actor) throw AppError.unauthorized("An active user is required.");
    if (actor.role !== "super-admin") {
      throw AppError.forbidden("System administrator access is required.");
    }
    const previous = await this.get();
    await (this.context.persistEnvironment ?? updateBrandingEnvironment)(input);
    try {
      await this.context.database
        .updateTable("app_branding_settings")
        .set(input)
        .where("id", "=", 1)
        .execute();
    } catch (error) {
      await (this.context.persistEnvironment ?? updateBrandingEnvironment)(previous);
      throw error;
    }
    return this.get();
  }
}
