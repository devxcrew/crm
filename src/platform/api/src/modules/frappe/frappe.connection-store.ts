import { sql, type Kysely } from "kysely";
import { decryptIntegrationCredential, encryptIntegrationCredential } from "../../security/integration-credential.js";
import type { TechMediaDatabase } from "../../database/schema.js";
import type { FrappeConnectionCredentials, FrappeConnectionSettings, FrappeConnectionVerificationStatus } from "./frappe.types.js";

type StoredConnection = {
  api_key_ciphertext: string | null;
  api_secret_ciphertext: string | null;
  base_url: string;
  connection_name: string;
  enabled: number | boolean;
  last_checked_at: Date | string | null;
  last_verified_at: Date | string | null;
  updated_at: Date | string;
  verification_status: FrappeConnectionVerificationStatus;
};

export async function readFrappeConnection(database: Kysely<TechMediaDatabase>) {
  const row = await database.selectFrom("frappe_connection_settings").selectAll().where("id", "=", 1).executeTakeFirst();
  return row ? mapStored(row) : null;
}

export async function readFrappeSettings(database: Kysely<TechMediaDatabase>): Promise<FrappeConnectionSettings | null> {
  const row = await readFrappeConnection(database);
  return row?.settings ?? null;
}

export async function writeFrappeConnection(database: Kysely<TechMediaDatabase>, input: {
  appKey?: string; appSecret?: string; baseUrl: string; connectionName: string; enabled: boolean;
}) {
  const current = await readFrappeConnection(database);
  const apiKeyCiphertext = input.appKey ? encryptIntegrationCredential(input.appKey, "frappe-application") : current?.apiKeyCiphertext ?? null;
  const apiSecretCiphertext = input.appSecret ? encryptIntegrationCredential(input.appSecret, "frappe-application") : current?.apiSecretCiphertext ?? null;
  await database.insertInto("frappe_connection_settings").values({ id: 1, connection_name: input.connectionName, base_url: input.baseUrl, api_key_ciphertext: apiKeyCiphertext, api_secret_ciphertext: apiSecretCiphertext, enabled: input.enabled, verification_status: "unverified", last_checked_at: null, last_verified_at: null }).onDuplicateKeyUpdate({ connection_name: input.connectionName, base_url: input.baseUrl, api_key_ciphertext: apiKeyCiphertext, api_secret_ciphertext: apiSecretCiphertext, enabled: input.enabled, verification_status: "unverified", last_checked_at: null, last_verified_at: null }).execute();
  return readFrappeSettings(database);
}

export async function recordFrappeVerification(database: Kysely<TechMediaDatabase>, status: FrappeConnectionVerificationStatus, checkedAt: string, verifiedAt: string | null = null) {
  await database.updateTable("frappe_connection_settings").set({ verification_status: status, last_checked_at: new Date(checkedAt), last_verified_at: verifiedAt ? new Date(verifiedAt) : null }).where("id", "=", 1).execute();
}

function mapStored(row: StoredConnection) {
  const apiKey = row.api_key_ciphertext ? decryptIntegrationCredential(row.api_key_ciphertext, "frappe-application") : "";
  const apiSecret = row.api_secret_ciphertext ? decryptIntegrationCredential(row.api_secret_ciphertext, "frappe-application") : "";
  const timestamp = (value: Date | string | null) => value ? new Date(value).toISOString() : null;
  return { apiKey, apiKeyCiphertext: row.api_key_ciphertext, apiSecret, apiSecretCiphertext: row.api_secret_ciphertext, settings: { appKeyConfigured: Boolean(apiKey), appSecretConfigured: Boolean(apiSecret), baseUrl: row.base_url, connectionName: row.connection_name, enabled: Boolean(row.enabled), id: 1, lastCheckedAt: timestamp(row.last_checked_at), lastVerifiedAt: timestamp(row.last_verified_at), updatedAt: new Date(row.updated_at).toISOString(), uuid: "frappe01", verificationStatus: row.verification_status } };
}
