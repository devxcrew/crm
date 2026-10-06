import { AppError } from "@codexsun/framework/errors";
import { recordAuditEvent } from "../../database/audit.js";
import { env } from "../../env.js";
import { userFrappeCredentialContract, userFrappeImportContract } from "../user/index.js";
import { userRoleStandardAccessContract } from "../user-role/index.js";
import type {
  FrappeConnectionCredentials,
  FrappeConnectionSavePayload,
  FrappeConnectionSettings,
  FrappeConnectionVerificationPayload,
  FrappeConnectionVerificationResult,
  FrappeConnectionVerificationStatus,
  FrappeContext,
  FrappeUserImportResult,
  FrappeUserPreview,
  FrappeUserVerificationResult
} from "./frappe.types.js";
import { readFrappeSettings, recordFrappeVerification, writeFrappeConnection } from "./frappe.connection-store.js";

const handshakePath = "/api/method/frappe.auth.get_logged_user";
const maximumHandshakeResponseBytes = 64 * 1024;

export class FrappeService {
  constructor(private readonly context: FrappeContext) {}

  async get() {
    await this.context.authorize("settings.frappe.view");
    return readFrappeSettings(this.context.database);
  }

  async save(input: FrappeConnectionSavePayload): Promise<FrappeConnectionSettings> {
    await this.context.authorize("settings.frappe.update");
    const baseUrl = normalizeBaseUrl(input.baseUrl);
    const connectionName = input.connectionName.trim();
    const saved = await writeFrappeConnection(this.context.database, { ...(input.appKey ? { appKey: input.appKey.trim() } : {}), ...(input.appSecret ? { appSecret: input.appSecret.trim() } : {}), baseUrl, connectionName, enabled: input.enabled });
    await recordAuditEvent({
      action: "saved",
      actorEmail: this.context.actorEmail,
      moduleKey: "settings.frappe",
      recordLabel: connectionName
    });
    return saved!;
  }

  async verify(
    input: FrappeConnectionVerificationPayload
  ): Promise<FrappeConnectionVerificationResult> {
    await this.context.authorize("settings.frappe.update");
    const connection = environmentConnection();
    const baseUrl = normalizeBaseUrl(input.baseUrl || connection.baseUrl);
    const appKey = input.appKey?.trim() || env.FRAPPE_APP_KEY.trim();
    const appSecret = input.appSecret?.trim() || env.FRAPPE_APP_SECRET.trim();
    if (!appKey || !appSecret) {
      throw AppError.validation("Configure FRAPPE_APP_KEY and FRAPPE_APP_SECRET in .env.");
    }

    let result: FrappeConnectionVerificationResult;
    try {
      result = await verifyFrappeHandshake({
        apiKey: appKey,
        apiSecret: appSecret,
        baseUrl
      });
      if (matchesSavedConnection(input, baseUrl)) {
        await saveVerificationState(this.context.database, "live", result.checkedAt, result.checkedAt);
      }
    } catch (error) {
      if (matchesSavedConnection(input, baseUrl)) {
        await saveVerificationState(this.context.database, "offline", new Date().toISOString());
      }
      await recordAuditEvent({
        action: "verification_failed",
        actorEmail: this.context.actorEmail,
        moduleKey: "settings.frappe",
        recordLabel: baseUrl
      });
      throw error;
    }
    await recordAuditEvent({
      action: "verified",
      actorEmail: this.context.actorEmail,
      moduleKey: "settings.frappe",
      recordLabel: baseUrl
    });
    return result;
  }

  async verifyUser(userId: number): Promise<FrappeUserVerificationResult> {
    await this.context.authorize("identity.user.update");
    const connection = environmentConnection();
    const verified = await verifyUserAgainstConnection(this.context.database, userId, connection);
    const credentials = await userFrappeCredentialContract(this.context.database).find(userId);
    if (!credentials) throw missingUserCredentials();
    const employeeCode = await requiredFrappeEmployeeName({
      apiKey: credentials.apiKey,
      apiSecret: credentials.apiSecret,
      authenticatedUser: verified.authenticatedUser,
      baseUrl: connection.baseUrl,
      connectionName: connection.connectionName,
      enabled: connection.enabled
    });
    await userFrappeCredentialContract(this.context.database).recordVerification(
      userId,
      "live",
      new Date(verified.checkedAt),
      verified.authenticatedUser,
      employeeCode
    );
    return { ...verified, employeeCode };
  }

  async previewUsers(): Promise<FrappeUserPreview[]> {
    await this.context.authorize("settings.frappe.view");
    await this.context.authorize("identity.user.view");
    const connection = this.applicationConnection();
    const fields = JSON.stringify([
      "name",
      "full_name",
      "email",
      "username",
      "enabled",
      "user_type",
      "last_active"
    ]);
    const filters = JSON.stringify([
      ["enabled", "=", 1],
      ["user_type", "=", "System User"]
    ]);
    const response = await frappeRequest<{ data?: FrappeUserDocument[] }>(
      connection,
      `/api/resource/User?fields=${encodeURIComponent(fields)}&filters=${encodeURIComponent(filters)}&limit_page_length=500&order_by=full_name%20asc`
    );
    const localUsers = await userFrappeImportContract({
      actorEmail: this.context.actorEmail,
      database: this.context.database
    }).listExisting();
    const localByEmail = new Map(localUsers.map((user) => [user.email.toLowerCase(), user]));

    return (response.data ?? [])
      .filter((user) => !["Administrator", "Guest"].includes(user.name))
      .map((user) => toFrappeUserPreview(user, localByEmail))
      .filter((user): user is FrappeUserPreview => Boolean(user))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async importUser(frappeUserId: string): Promise<FrappeUserImportResult> {
    await this.context.authorize("settings.frappe.update");
    await this.context.authorize("identity.user.create");
    const connection = this.applicationConnection();
    const fields = JSON.stringify([
      "name",
      "full_name",
      "email",
      "username",
      "enabled",
      "user_type"
    ]);
    const filters = JSON.stringify([
      ["name", "=", frappeUserId.trim()],
      ["enabled", "=", 1],
      ["user_type", "=", "System User"]
    ]);
    const response = await frappeRequest<{ data?: FrappeUserDocument[] }>(
      connection,
      `/api/resource/User?fields=${encodeURIComponent(fields)}&filters=${encodeURIComponent(filters)}&limit_page_length=1`
    );
    const remote = response.data?.[0];
    if (!remote) {
      throw AppError.validation("Only enabled Frappe System Users can be added.");
    }
    const email = frappeUserEmail(remote);
    if (!email) throw AppError.validation("Frappe user must have a valid email address.");
    const result = await userFrappeImportContract({
      actorEmail: this.context.actorEmail,
      database: this.context.database
    }).importUser({
      email,
      name: remote.full_name?.trim() || remote.username?.trim() || email
    });
    await userRoleStandardAccessContract({
      actorEmail: this.context.actorEmail,
      database: this.context.database
    }).ensureForUser(result.user.id);
    await recordAuditEvent({
      action: result.created ? "user_imported" : "user_already_exists",
      actorEmail: this.context.actorEmail,
      moduleKey: "frappe.user-sync",
      recordId: result.user.id,
      recordLabel: remote.name,
      recordUuid: result.user.uuid
    });
    return result;
  }

  private applicationConnection() {
    const connection = environmentConnection();
    if (!connection.enabled) {
      throw AppError.conflict("Enable the Frappe connection before loading users.");
    }
    if (!connection.apiKey || !connection.apiSecret) {
      throw AppError.validation(
        "Save and verify the application Frappe API key and secret before loading users."
      );
    }
    return connection;
  }
}

type FrappeUserDocument = {
  email?: string;
  enabled?: number | boolean;
  full_name?: string;
  last_active?: string | null;
  name: string;
  user_type?: string;
  username?: string;
};

export function frappeConnectionContract(context: {
  database: FrappeContext["database"];
  userId: number;
}) {
  return {
    async get(): Promise<FrappeConnectionCredentials | null> {
      const connection = environmentConnection();
      const credentials = await userFrappeCredentialContract(context.database).find(context.userId);
      if (!credentials) return null;
      return {
        apiKey: credentials.apiKey,
        apiSecret: credentials.apiSecret,
        authenticatedUser: credentials.authenticatedUser,
        baseUrl: connection.baseUrl,
        connectionName: connection.connectionName,
        enabled: connection.enabled
      };
    }
  };
}

async function requiredFrappeEmployeeName(connection: FrappeConnectionCredentials) {
  const authenticatedUser = connection.authenticatedUser?.trim();
  if (!authenticatedUser) {
    throw AppError.conflict("Verify this user's Frappe API credentials before using CRM.");
  }
  const filters = JSON.stringify([["user_id", "=", authenticatedUser]]);
  const path = `/api/resource/Employee?fields=${encodeURIComponent('["name"]')}&filters=${encodeURIComponent(filters)}&limit_page_length=1`;
  const employees = await frappeRequest<{ data?: Array<{ name?: string }> }>(connection, path);
  const employeeName = employees.data?.[0]?.name?.trim();
  if (!employeeName) {
    throw AppError.validation(
      `Frappe user ${authenticatedUser} must be linked to an Employee before using CRM.`
    );
  }
  return employeeName;
}

export function frappeUserAuthenticationContract(database: FrappeContext["database"]) {
  return {
    async statusForLogin(userId: number) {
      const connection = optionalEnvironmentConnection();
      if (!connection?.enabled) {
        return {
          authenticatedUser: null,
          employeeCode: null,
          status: connection ? ("disabled" as const) : ("not_configured" as const)
        };
      }
      const credentials = await userFrappeCredentialContract(database).find(userId);
      if (!credentials) {
        return { authenticatedUser: null, employeeCode: null, status: "not_configured" as const };
      }
      if (
        credentials.verificationStatus === "live" &&
        credentials.authenticatedUser?.trim() &&
        credentials.employeeCode?.trim()
      ) {
        return {
          authenticatedUser: credentials.authenticatedUser,
          employeeCode: credentials.employeeCode,
          status: "live" as const
        };
      }
      return { authenticatedUser: null, employeeCode: null, status: "offline" as const };
    }
  };
}

function publicSettings(): FrappeConnectionSettings | null {
  const connection = optionalEnvironmentConnection();
  if (!connection) return null;
  return {
    appKeyConfigured: Boolean(env.FRAPPE_APP_KEY.trim()),
    appSecretConfigured: Boolean(env.FRAPPE_APP_SECRET.trim()),
    baseUrl: connection.baseUrl,
    connectionName: connection.connectionName,
    enabled: connection.enabled,
    id: 1,
    lastCheckedAt: env.FRAPPE_LAST_CHECKED_AT || null,
    lastVerifiedAt: env.FRAPPE_LAST_VERIFIED_AT || null,
    updatedAt: env.FRAPPE_UPDATED_AT || new Date(0).toISOString(),
    uuid: "frappe01",
    verificationStatus: env.FRAPPE_VERIFICATION_STATUS
  };
}

function matchesSavedConnection(input: FrappeConnectionVerificationPayload, baseUrl: string) {
  return (
    baseUrl === optionalEnvironmentConnection()?.baseUrl &&
    (!input.appKey || input.appKey.trim() === env.FRAPPE_APP_KEY.trim()) &&
    (!input.appSecret || input.appSecret.trim() === env.FRAPPE_APP_SECRET.trim())
  );
}

async function saveVerificationState(
  database: FrappeContext["database"],
  status: FrappeConnectionVerificationStatus,
  checkedAt: string,
  verifiedAt: string | null = null
) {
  await recordFrappeVerification(database, status, checkedAt, verifiedAt);
}

function environmentConnection(): FrappeConnectionCredentials {
  const connection = optionalEnvironmentConnection();
  if (!connection) {
    throw AppError.conflict("Configure FRAPPE_BASE_URL in .env before using Frappe.");
  }
  return connection;
}

function optionalEnvironmentConnection(): FrappeConnectionCredentials | null {
  const baseUrl = env.FRAPPE_BASE_URL.trim();
  if (!baseUrl) return null;
  return {
    apiKey: env.FRAPPE_APP_KEY.trim(),
    apiSecret: env.FRAPPE_APP_SECRET.trim(),
    authenticatedUser: null,
    baseUrl: normalizeBaseUrl(baseUrl),
    connectionName: env.FRAPPE_CONNECTION_NAME.trim() || "Frappe",
    enabled: env.FRAPPE_ENABLED === "1"
  };
}

function normalizeBaseUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw AppError.validation("Frappe URL must be a valid HTTP or HTTPS URL.");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw AppError.validation("Frappe URL must use HTTP or HTTPS without embedded credentials.");
  }
  if (url.search || url.hash) {
    throw AppError.validation("Frappe URL must not contain query parameters or a fragment.");
  }
  return url.toString().replace(/\/$/u, "");
}

async function verifyFrappeHandshake(input: {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
}): Promise<FrappeConnectionVerificationResult> {
  const startedAt = Date.now();
  let response: Response;
  try {
    response = await fetch(`${input.baseUrl}${handshakePath}`, {
      headers: {
        Accept: "application/json",
        Authorization: `token ${input.apiKey}:${input.apiSecret}`
      },
      method: "GET",
      redirect: "error",
      signal: AbortSignal.timeout(8_000)
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
      throw new AppError({
        code: "FRAPPE_CONNECTION_TIMEOUT",
        message: "Frappe did not respond within 8 seconds.",
        statusCode: 504
      });
    }
    throw new AppError({
      code: "FRAPPE_CONNECTION_FAILED",
      message: "CRM could not reach the Frappe server.",
      statusCode: 502
    });
  }

  if (response.status === 401 || response.status === 403) {
    throw AppError.validation("Frappe rejected the API key or API secret.");
  }
  if (!response.ok) {
    throw new AppError({
      code: "FRAPPE_HANDSHAKE_FAILED",
      message: `Frappe handshake failed with HTTP ${response.status}.`,
      statusCode: 502
    });
  }

  const body = await readHandshakeBody(response);
  const authenticatedUser =
    typeof body.message === "string" && body.message.trim() ? body.message.trim() : "";
  if (!authenticatedUser) {
    throw new AppError({
      code: "FRAPPE_HANDSHAKE_INVALID",
      message: "The server response was not a valid authenticated Frappe handshake.",
      statusCode: 502
    });
  }
  return {
    authenticatedUser,
    baseUrl: input.baseUrl,
    checkedAt: new Date().toISOString(),
    connected: true,
    latencyMs: Date.now() - startedAt
  };
}

async function verifyUserAgainstConnection(
  database: FrappeContext["database"],
  userId: number,
  connection: FrappeConnectionCredentials
) {
  const credentialContract = userFrappeCredentialContract(database);
  const credentials = await credentialContract.find(userId);
  if (!credentials) throw missingUserCredentials();
  try {
    const result = await verifyFrappeHandshake({
      apiKey: credentials.apiKey,
      apiSecret: credentials.apiSecret,
      baseUrl: connection.baseUrl
    });
    await credentialContract.recordVerification(
      userId,
      "live",
      new Date(result.checkedAt),
      result.authenticatedUser
    );
    return result;
  } catch (error) {
    await credentialContract.recordVerification(userId, "offline", new Date(), null);
    throw error;
  }
}

function missingUserCredentials() {
  return AppError.validation(
    "This user must have a Frappe API key and API secret configured before connecting."
  );
}

async function readHandshakeBody(response: Response): Promise<{ message?: unknown }> {
  if (!response.body) {
    throw invalidHandshakeResponse();
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    bytes += part.value.byteLength;
    if (bytes > maximumHandshakeResponseBytes) {
      await reader.cancel();
      throw invalidHandshakeResponse();
    }
    chunks.push(part.value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as { message?: unknown };
  } catch {
    throw invalidHandshakeResponse();
  }
}

function invalidHandshakeResponse() {
  return new AppError({
    code: "FRAPPE_HANDSHAKE_INVALID",
    message: "The server returned an invalid Frappe handshake response.",
    statusCode: 502
  });
}

export async function frappeRequest<T = unknown>(
  connection: FrappeConnectionCredentials,
  path: string,
  init: RequestInit = {},
  acceptedStatuses: number[] = []
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${connection.baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: `token ${connection.apiKey}:${connection.apiSecret}`,
        "Content-Type": "application/json",
        ...init.headers
      },
      redirect: "error",
      signal: AbortSignal.timeout(15_000)
    });
  } catch {
    throw new AppError({
      code: "FRAPPE_SYNC_UNAVAILABLE",
      message: "CRM could not reach the live Frappe server.",
      statusCode: 502
    });
  }
  const responseBody = await readFrappeResponseBody(response);
  if (!response.ok && !acceptedStatuses.includes(response.status)) {
    const upstreamMessage = frappeErrorMessage(responseBody);
    if (response.status === 401 || response.status === 403) {
      throw new AppError({
        code: "FRAPPE_AUTHENTICATION_FAILED",
        message: connection.authenticatedUser
          ? "Frappe rejected this user's saved API key or secret. Update the credentials and verify them once."
          : "Frappe rejected the application API key or secret. Update and verify the connection in Settings.",
        statusCode: 422
      });
    }
    const validationStatus = [409, 417, 422].includes(response.status);
    if (response.status === 404) {
      throw AppError.notFound(upstreamMessage || "The requested Frappe record was not found.");
    }
    throw new AppError({
      code: validationStatus ? "FRAPPE_VALIDATION_FAILED" : "FRAPPE_REQUEST_FAILED",
      message: upstreamMessage
        ? `Frappe rejected the request: ${upstreamMessage}`
        : `Frappe request failed with HTTP ${response.status}.`,
      statusCode: validationStatus ? 422 : 502
    });
  }
  return responseBody as T;
}

async function readFrappeResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}

function frappeErrorMessage(body: unknown) {
  if (!body || typeof body !== "object") return "";
  const value = body as Record<string, unknown>;
  const direct = safeFrappeMessage(value.message);
  if (direct) return direct;
  if (typeof value._server_messages !== "string") return "";
  try {
    const messages = JSON.parse(value._server_messages) as unknown;
    if (!Array.isArray(messages)) return "";
    for (const item of messages) {
      if (typeof item !== "string") continue;
      try {
        const parsed = JSON.parse(item) as { message?: unknown };
        const message = safeFrappeMessage(parsed.message);
        if (message) return message;
      } catch {
        const message = safeFrappeMessage(item);
        if (message) return message;
      }
    }
  } catch {
    return "";
  }
  return "";
}

function safeFrappeMessage(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .replace(/<[^>]*>/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 500);
}

function frappeUserEmail(user: FrappeUserDocument) {
  const candidate = (user.email || user.name).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(candidate) ? candidate : "";
}

function toFrappeUserPreview(
  user: FrappeUserDocument,
  localByEmail: Map<
    string,
    { email: string; id: number; status: "active" | "inactive" | "suspended" }
  >
): FrappeUserPreview | null {
  const email = frappeUserEmail(user);
  if (!email) return null;
  const local = localByEmail.get(email);
  return {
    email,
    enabled: Boolean(user.enabled),
    frappeUserId: user.name,
    lastActiveAt: user.last_active?.trim() || null,
    localStatus: local?.status ?? null,
    localUserId: local?.id ?? null,
    name: user.full_name?.trim() || user.username?.trim() || email,
    userType: user.user_type?.trim() || "System User"
  };
}
