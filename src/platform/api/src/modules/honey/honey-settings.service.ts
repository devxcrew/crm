import { AppError } from "@codexsun/framework/errors";
import type { ReturnTypeIdentityContext } from "./honey.types.js";

const globalAvailabilityKey = "global-availability";
const petMobileVisibleKey = "pet-mobile-visible";
const petWebVisibleKey = "pet-web-visible";

export class HoneySettingsService {
  constructor(private readonly context: ReturnTypeIdentityContext) {}

  async availability() {
    await this.requireActor();
    const setting = await this.context.database
      .selectFrom("ai_honey_settings")
      .select("enabled")
      .where("setting_key", "=", globalAvailabilityKey)
      .executeTakeFirstOrThrow();
    return { enabled: Boolean(setting.enabled) };
  }

  async updateAvailability(enabled: boolean) {
    await this.requireSystemAdmin();
    await this.context.database
      .updateTable("ai_honey_settings")
      .set({ enabled })
      .where("setting_key", "=", globalAvailabilityKey)
      .execute();
    return { enabled };
  }

  async petVisibility() {
    await this.requireActor();
    const settings = await this.context.database
      .selectFrom("ai_honey_settings")
      .select(["enabled", "setting_key"])
      .where("setting_key", "in", [petMobileVisibleKey, petWebVisibleKey])
      .execute();
    const values = new Map(
      settings.map((setting) => [setting.setting_key, Boolean(setting.enabled)])
    );
    return {
      mobileEnabled: values.get(petMobileVisibleKey) ?? true,
      webEnabled: values.get(petWebVisibleKey) ?? true
    };
  }

  async updatePetVisibility(input: { mobileEnabled: boolean; webEnabled: boolean }) {
    await this.requireSystemAdmin();
    await this.context.database.transaction().execute(async (transaction) => {
      await transaction
        .updateTable("ai_honey_settings")
        .set({ enabled: input.mobileEnabled })
        .where("setting_key", "=", petMobileVisibleKey)
        .execute();
      await transaction
        .updateTable("ai_honey_settings")
        .set({ enabled: input.webEnabled })
        .where("setting_key", "=", petWebVisibleKey)
        .execute();
    });
    return input;
  }

  async requireEnabled() {
    const setting = await this.availability();
    if (!setting.enabled) {
      throw new AppError({
        code: "AI_TEMA_DISABLED",
        message: "TEMA is disabled by the system administrator.",
        statusCode: 503
      });
    }
  }

  private async requireActor() {
    const actor = await this.context.actorUser();
    if (!actor) throw AppError.unauthorized("An active user is required.");
    return actor;
  }

  private async requireSystemAdmin() {
    const actor = await this.requireActor();
    if (actor.role !== "super-admin") {
      throw AppError.forbidden("System administrator access is required.");
    }
    return actor;
  }
}
