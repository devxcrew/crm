import { randomBytes } from "node:crypto";
import { AppError } from "@codexsun/framework/errors";
import { hashPassword } from "../../auth/password-hash.js";
import { recordAuditEvent } from "../../database/audit.js";
import {
  decryptIntegrationCredential,
  encryptIntegrationCredential
} from "../../security/integration-credential.js";
import { userRoleStandardAccessContract } from "../user-role/index.js";
import { UserRepository } from "./user.repository.js";
import type {
  User,
  UserContext,
  UserFrappeImportPayload,
  UserFrappeImportResult,
  UserListFilters,
  UserProfile,
  UserProfileSavePayload,
  UserSavePayload,
  UserStatus
} from "./user.types.js";
import type { Kysely } from "kysely";
import type { TechMediaDatabase } from "../../database/schema.js";

export class UserService {
  private readonly repository: UserRepository;
  constructor(private readonly context: UserContext) {
    this.repository = new UserRepository(context.database);
  }
  async list(filters: UserListFilters = {}) {
    await this.context.authorize("identity.user.view");
    return this.repository.list(filters);
  }
  async get(id: string) {
    await this.context.authorize("identity.user.view");
    return this.repository.find(id);
  }
  async getProfile(): Promise<UserProfile> {
    const record = await this.repository.findByEmail(this.context.actorEmail);
    if (!record) throw AppError.notFound("Signed-in user was not found.");
    return profile(record);
  }
  async updateProfile(input: UserProfileSavePayload): Promise<UserProfile> {
    const current = await this.repository.findByEmail(this.context.actorEmail);
    if (!current) throw AppError.notFound("Signed-in user was not found.");
    const value = normalizeProfile(input);
    const record = (await this.save(() =>
      this.repository.updateProfile(
        current.id,
        value,
        value.password ? hashPassword(value.password) : undefined
      )
    ))!;
    await this.audit("profile-updated", record);
    return profile(record);
  }
  async create(input: UserSavePayload) {
    await this.context.authorize("identity.user.create");
    const value = normalize(input, true);
    const credentials = await this.credentialsForSave(value, null);
    let record = await this.save(() =>
      this.repository.create(
        value,
        randomBytes(4).toString("hex"),
        hashPassword(value.password!),
        credentials
      )
    );
    const access = userRoleStandardAccessContract({
      actorEmail: this.context.actorEmail,
      database: this.context.database
    });
    await access.ensureForUser(record.id);
    if (value.roleId) await access.setPrimaryRole(record.id, value.roleId);
    record = (await this.repository.find(record.id))!;
    await this.audit("created", record);
    return record;
  }
  async update(id: string, input: UserSavePayload) {
    await this.context.authorize("identity.user.update");
    const current = await this.required(id);
    let value = normalize(input, false);
    if (current.id === 1) {
      if (value.name !== current.name || value.status !== current.status) {
        throw AppError.forbidden("The protected system user's name and status cannot be modified.");
      }
      // The edit form always carries the current role. Ignore that no-op value so a
      // protected administrator can still maintain its own Frappe credentials.
      const { roleId: _roleId, ...protectedValue } = value;
      value = protectedValue;
    }
    const currentCredentials = await this.repository.findFrappeCredentials(current.id);
    const credentials = await this.credentialsForSave(value, currentCredentials);
    let record = (await this.save(() =>
      this.repository.update(
        current.id,
        value,
        value.password ? hashPassword(value.password) : undefined
      )
    ))!;
    if (credentials.changed) {
      record = (await this.repository.updateFrappeCredentials(current.id, credentials))!;
    }
    if (value.frappeEmployeeCode !== undefined) {
      record = (await this.repository.updateFrappeEmployeeCode(
        current.id,
        value.frappeEmployeeCode || null
      ))!;
    }
    if (value.roleId) {
      await userRoleStandardAccessContract({
        actorEmail: this.context.actorEmail,
        database: this.context.database
      }).setPrimaryRole(record.id, value.roleId);
      record = (await this.repository.find(record.id))!;
    }
    await this.audit("updated", record);
    return record;
  }
  async setStatus(id: string, status: UserStatus) {
    await this.context.authorize("identity.user.suspend");
    const current = await this.mutable(id);
    const record = (await this.repository.setStatus(current.id, status))!;
    await this.audit(status === "active" ? "restored" : "suspended", record);
    return record;
  }
  async forceDelete(id: string) {
    await this.context.authorize("identity.user.delete");
    const current = await this.mutable(id);
    const record = await this.deleteWithRoleAssignments(current.id);
    await this.audit("force-deleted", record);
    return record;
  }
  private async mutable(id: string): Promise<User> {
    const record = await this.required(id);
    if (record.id === 1) throw AppError.forbidden("The protected system user cannot be modified.");
    return record;
  }
  private async required(id: string): Promise<User> {
    const record = await this.repository.find(id);
    if (!record) throw AppError.notFound("User was not found.");
    return record;
  }
  private async credentialsForSave(
    input: UserSavePayload,
    current: Awaited<ReturnType<UserRepository["findFrappeCredentials"]>>
  ) {
    const apiKey = input.frappeApiKey?.trim();
    const apiSecret = input.frappeApiSecret?.trim();
    const apiKeyCiphertext = apiKey
      ? encryptIntegrationCredential(apiKey, "frappe")
      : (current?.apiKeyCiphertext ?? null);
    const apiSecretCiphertext = apiSecret
      ? encryptIntegrationCredential(apiSecret, "frappe")
      : (current?.apiSecretCiphertext ?? null);
    if (Boolean(apiKeyCiphertext) !== Boolean(apiSecretCiphertext)) {
      throw AppError.validation("Frappe API key and API secret must both be configured.");
    }
    return {
      apiKeyCiphertext,
      apiSecretCiphertext,
      changed: Boolean(apiKey || apiSecret),
      verificationStatus:
        apiKey || apiSecret
          ? ("unverified" as const)
          : (current?.verificationStatus ?? "unverified")
    };
  }
  private async audit(action: string, record: User) {
    await recordAuditEvent({
      action,
      actorEmail: this.context.actorEmail,
      moduleKey: "identity.user",
      recordId: record.id,
      recordLabel: record.name,
      recordUuid: record.uuid
    });
  }
  private async save<T>(work: () => Promise<T>) {
    try {
      return await work();
    } catch (error) {
      if (isDuplicate(error)) throw AppError.conflict("User email already exists.");
      throw error;
    }
  }
  private async deleteWithRoleAssignments(id: number) {
    try {
      return (await this.repository.forceDeleteWithRoleAssignments(id))!;
    } catch (error) {
      if (isReferenced(error)) {
        throw AppError.conflict(
          "User cannot be force deleted because business or audit records reference it."
        );
      }
      throw error;
    }
  }
}

/** Fixed public lookup contract for modules that reference active users. */
export function userReferenceContract(database: Kysely<TechMediaDatabase>) {
  const repository = new UserRepository(database);
  return {
    find: (id: number) => repository.findActiveReference(id),
    list: () => repository.listActiveReferences()
  };
}

/** Fixed public contract used by the Frappe module without exposing credentials to clients. */
export function userFrappeCredentialContract(database: Kysely<TechMediaDatabase>) {
  const repository = new UserRepository(database);
  return {
    async find(userId: number) {
      const stored = await repository.findFrappeCredentials(userId);
      if (!stored?.apiKeyCiphertext || !stored.apiSecretCiphertext) return null;
      return {
        apiKey: decryptIntegrationCredential(stored.apiKeyCiphertext, "frappe"),
        apiSecret: decryptIntegrationCredential(stored.apiSecretCiphertext, "frappe"),
        authenticatedUser: stored.authenticatedUser,
        employeeCode: stored.employeeCode,
        lastCheckedAt: stored.lastCheckedAt,
        lastVerifiedAt: stored.lastVerifiedAt,
        verificationStatus: stored.verificationStatus
      };
    },
    recordVerification: (
      userId: number,
      status: "live" | "offline",
      checkedAt: Date,
      authenticatedUser: string | null,
      employeeCode?: string | null
    ) =>
      repository.recordFrappeVerification(
        userId,
        status,
        checkedAt,
        authenticatedUser,
        employeeCode
      ),
    resetVerification: () => repository.resetFrappeVerification()
  };
}

/**
 * Public application-service contract used by Frappe user sync. User
 * remains the only module that creates local user rows and hashes passwords.
 */
export function userFrappeImportContract(context: {
  actorEmail: string;
  database: Kysely<TechMediaDatabase>;
}) {
  const repository = new UserRepository(context.database);
  return {
    async importUser(input: UserFrappeImportPayload): Promise<UserFrappeImportResult> {
      const email = input.email.trim().toLowerCase();
      const name = input.name.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
        throw AppError.validation("Frappe user must have a valid email address.");
      }
      if (name.length < 2) throw AppError.validation("Frappe user must have a valid name.");
      const current = await repository.findByEmail(email);
      if (current) return { created: false, temporaryPassword: null, user: current };

      const temporaryPassword = `Tm!${randomBytes(12).toString("base64url")}`;
      let user: User;
      try {
        user = await repository.create(
          { email, name, status: "active" },
          randomBytes(4).toString("hex"),
          hashPassword(temporaryPassword),
          {
            apiKeyCiphertext: null,
            apiSecretCiphertext: null,
            verificationStatus: "unverified"
          }
        );
      } catch (error) {
        if (!isDuplicate(error)) throw error;
        const duplicate = await repository.findByEmail(email);
        if (!duplicate) throw error;
        return { created: false, temporaryPassword: null, user: duplicate };
      }
      await recordAuditEvent({
        action: "imported_from_frappe",
        actorEmail: context.actorEmail,
        moduleKey: "identity.user",
        recordId: user.id,
        recordLabel: user.name,
        recordUuid: user.uuid
      });
      return { created: true, temporaryPassword, user };
    },
    async listExisting() {
      return (await repository.list()).map(({ email, id, status }) => ({ email, id, status }));
    }
  };
}
function normalize(input: UserSavePayload, creating: boolean): UserSavePayload {
  const password = input.password?.trim();
  if (creating && (!password || password.length < 8))
    throw AppError.validation("Password must contain at least 8 characters.");
  return {
    email: input.email.trim().toLowerCase(),
    ...(input.frappeApiKey?.trim() ? { frappeApiKey: input.frappeApiKey.trim() } : {}),
    ...(input.frappeApiSecret?.trim() ? { frappeApiSecret: input.frappeApiSecret.trim() } : {}),
    ...(input.frappeEmployeeCode !== undefined
      ? { frappeEmployeeCode: input.frappeEmployeeCode.trim() }
      : {}),
    name: input.name.trim(),
    ...(password ? { password } : {}),
    ...(input.roleId ? { roleId: input.roleId } : {}),
    status: input.status
  };
}
function normalizeProfile(input: UserProfileSavePayload): UserProfileSavePayload {
  const password = input.password?.trim();
  if (password && password.length < 8)
    throw AppError.validation("Password must contain at least 8 characters.");
  return {
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    ...(password ? { password } : {})
  };
}
function profile(record: User): UserProfile {
  return {
    email: record.email,
    id: record.id,
    name: record.name,
    uuid: record.uuid
  };
}
function isDuplicate(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ER_DUP_ENTRY"
  );
}

function isReferenced(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    (("code" in error && (error as { code?: unknown }).code === "ER_ROW_IS_REFERENCED_2") ||
      ("errno" in error && (error as { errno?: unknown }).errno === 1451))
  );
}
