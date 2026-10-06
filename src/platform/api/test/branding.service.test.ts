import assert from "node:assert/strict";
import { test } from "node:test";
import { AppError } from "@codexsun/framework/errors";
import { BrandingService } from "../src/modules/branding/branding.service.js";

function brandingDatabase(initial: { tagline: string; title: string }) {
  let value = initial;
  const database = {
    selectFrom: () => ({
      select: () => ({
        where: () => ({ executeTakeFirstOrThrow: async () => value })
      })
    }),
    updateTable: () => ({
      set: (next: { tagline: string; title: string }) => ({
        where: () => ({
          execute: async () => {
            value = { ...value, ...next };
          }
        })
      })
    })
  };

  return database as never;
}

test("only a super admin can update persisted app branding", async () => {
  const database = brandingDatabase({ tagline: "Client CRM workspace", title: "Client CRM" });
  const ordinaryUser = new BrandingService({
    actorUser: async () => ({ role: "administrator" }),
    database,
    persistEnvironment: async () => {}
  });

  await assert.rejects(
    ordinaryUser.update({ tagline: "Client workspace", title: "Client CRM" }),
    (error) => error instanceof AppError && error.statusCode === 403
  );

  const superAdmin = new BrandingService({
    actorUser: async () => ({ role: "super-admin" }),
    database,
    persistEnvironment: async () => {}
  });
  assert.deepEqual(await superAdmin.update({ tagline: "Client workspace", title: "Client CRM" }), {
    tagline: "Client workspace",
    title: "Client CRM"
  });
});
