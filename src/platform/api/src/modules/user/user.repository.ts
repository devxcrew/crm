import { sql, type Kysely } from "kysely";
import type { TechMediaDatabase } from "../../database/schema.js";
import type {
  User,
  UserFrappeVerificationStatus,
  UserListFilters,
  UserSavePayload,
  UserStatus
} from "./user.types.js";

type Row = {
  email: string;
  frappe_api_key_ciphertext: string | null;
  frappe_api_secret_ciphertext: string | null;
  frappe_authenticated_user: string | null;
  frappe_employee_code: string | null;
  frappe_last_checked_at: Date | string | null;
  frappe_last_verified_at: Date | string | null;
  frappe_verification_status: UserFrappeVerificationStatus;
  id: number;
  is_protected: number | boolean;
  name: string;
  role: string;
  status: UserStatus;
  uuid: string;
};

export class UserRepository {
  constructor(private readonly database: Kysely<TechMediaDatabase>) {}
  async list(filters: UserListFilters = {}) {
    const term = `%${(filters.search ?? "").trim().toLowerCase()}%`;
    const result = await sql<Row>`SELECT id,uuid,name,email,role,status,is_protected,
      frappe_api_key_ciphertext,frappe_api_secret_ciphertext,frappe_verification_status,
      frappe_authenticated_user,frappe_employee_code,frappe_last_checked_at,frappe_last_verified_at FROM users
      WHERE (${filters.search ?? ""}='' OR LOWER(name) LIKE ${term} OR LOWER(email) LIKE ${term}) ORDER BY name`.execute(
      this.database
    );
    return result.rows.map(mapRow);
  }
  async find(id: string | number) {
    const result = await sql<Row>`SELECT id,uuid,name,email,role,status,is_protected,
      frappe_api_key_ciphertext,frappe_api_secret_ciphertext,frappe_verification_status,
      frappe_authenticated_user,frappe_employee_code,frappe_last_checked_at,frappe_last_verified_at
      FROM users WHERE id=${Number(id)} LIMIT 1`.execute(this.database);
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }
  async findByEmail(email: string) {
    const result = await sql<Row>`SELECT id,uuid,name,email,role,status,is_protected,
      frappe_api_key_ciphertext,frappe_api_secret_ciphertext,frappe_verification_status,
      frappe_authenticated_user,frappe_employee_code,frappe_last_checked_at,frappe_last_verified_at
      FROM users WHERE LOWER(email)=LOWER(${email.trim()}) LIMIT 1`.execute(this.database);
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }
  async listActiveReferences() {
    const rows = await this.database
      .selectFrom("users")
      .select(["id", "uuid", "name", "email"])
      .where("status", "=", "active")
      .orderBy("name", "asc")
      .execute();
    return rows.map((row) => ({ ...row, id: Number(row.id) }));
  }
  async findActiveReference(id: number) {
    const row = await this.database
      .selectFrom("users")
      .select(["id", "uuid", "name", "email"])
      .where("id", "=", id)
      .where("status", "=", "active")
      .executeTakeFirst();
    return row ? { ...row, id: Number(row.id) } : null;
  }
  async create(
    input: UserSavePayload,
    uuid: string,
    passwordHash: string,
    credentials: FrappeCredentialWrite
  ) {
    const result = await sql`INSERT INTO users
      (uuid,name,email,password_hash,role,status,is_protected,frappe_api_key_ciphertext,
        frappe_api_secret_ciphertext,frappe_verification_status,frappe_employee_code)
      VALUES (${uuid},${input.name},${input.email},${passwordHash},'user',${input.status},FALSE,
        ${credentials.apiKeyCiphertext},${credentials.apiSecretCiphertext},
        ${credentials.verificationStatus},${input.frappeEmployeeCode?.trim() || null})`.execute(
      this.database
    );
    return (await this.find(Number(result.insertId)))!;
  }
  async update(id: number, input: UserSavePayload, passwordHash?: string) {
    if (passwordHash)
      await sql`UPDATE users SET name=${input.name},email=${input.email},password_hash=${passwordHash},status=${input.status} WHERE id=${id}`.execute(
        this.database
      );
    else
      await sql`UPDATE users SET name=${input.name},email=${input.email},status=${input.status} WHERE id=${id}`.execute(
        this.database
      );
    return this.find(id);
  }
  async updateProfile(id: number, input: { email: string; name: string }, passwordHash?: string) {
    if (passwordHash)
      await sql`UPDATE users SET name=${input.name},email=${input.email},password_hash=${passwordHash} WHERE id=${id}`.execute(
        this.database
      );
    else
      await sql`UPDATE users SET name=${input.name},email=${input.email} WHERE id=${id}`.execute(
        this.database
      );
    return this.find(id);
  }
  async updateFrappeCredentials(id: number, credentials: FrappeCredentialWrite) {
    await sql`UPDATE users SET
      frappe_api_key_ciphertext=${credentials.apiKeyCiphertext},
      frappe_api_secret_ciphertext=${credentials.apiSecretCiphertext},
      frappe_verification_status=${credentials.verificationStatus},
      frappe_authenticated_user=NULL,
      frappe_employee_code=NULL,
      frappe_last_checked_at=NULL,
      frappe_last_verified_at=NULL
      WHERE id=${id}`.execute(this.database);
    return this.find(id);
  }
  async updateFrappeEmployeeCode(id: number, employeeCode: string | null) {
    await sql`UPDATE users SET frappe_employee_code=${employeeCode} WHERE id=${id}`.execute(
      this.database
    );
    return this.find(id);
  }
  async findFrappeCredentials(id: number) {
    const row = await this.database
      .selectFrom("users")
      .select([
        "frappe_api_key_ciphertext",
        "frappe_api_secret_ciphertext",
        "frappe_authenticated_user",
        "frappe_employee_code",
        "frappe_last_checked_at",
        "frappe_last_verified_at",
        "frappe_verification_status"
      ])
      .where("id", "=", id)
      .executeTakeFirst();
    return row
      ? {
          apiKeyCiphertext: row.frappe_api_key_ciphertext,
          apiSecretCiphertext: row.frappe_api_secret_ciphertext,
          authenticatedUser: row.frappe_authenticated_user,
          employeeCode: row.frappe_employee_code,
          lastCheckedAt: nullableTimestamp(row.frappe_last_checked_at),
          lastVerifiedAt: nullableTimestamp(row.frappe_last_verified_at),
          verificationStatus: row.frappe_verification_status
        }
      : null;
  }
  async recordFrappeVerification(
    id: number,
    status: "live" | "offline",
    checkedAt: Date,
    authenticatedUser: string | null,
    employeeCode?: string | null
  ) {
    await sql`UPDATE users SET
      frappe_verification_status=${status},
      frappe_authenticated_user=${authenticatedUser},
      frappe_employee_code=CASE WHEN ${status}='live' THEN ${employeeCode ?? null} ELSE frappe_employee_code END,
      frappe_last_checked_at=${checkedAt},
      frappe_last_verified_at=CASE WHEN ${status}='live' THEN ${checkedAt} ELSE frappe_last_verified_at END
      WHERE id=${id}`.execute(this.database);
  }
  async resetFrappeVerification() {
    await sql`UPDATE users SET
      frappe_verification_status='unverified',
      frappe_authenticated_user=NULL,
      frappe_employee_code=NULL,
      frappe_last_checked_at=NULL,
      frappe_last_verified_at=NULL
      WHERE frappe_api_key_ciphertext IS NOT NULL OR frappe_api_secret_ciphertext IS NOT NULL`.execute(
      this.database
    );
  }
  async setStatus(id: number, status: UserStatus) {
    await sql`UPDATE users SET status=${status} WHERE id=${id}`.execute(this.database);
    return this.find(id);
  }
  async dependentCount(id: number) {
    const result = await sql<{
      count: number | string;
    }>`SELECT COUNT(*) count FROM user_roles WHERE user_id=${id}`.execute(this.database);
    return Number(result.rows[0]?.count ?? 0);
  }
  async forceDelete(id: number) {
    const record = await this.find(id);
    if (!record) return null;
    await sql`DELETE FROM users WHERE id=${id}`.execute(this.database);
    return record;
  }
  async forceDeleteWithRoleAssignments(id: number) {
    const record = await this.find(id);
    if (!record) return null;
    await this.database.transaction().execute(async (transaction) => {
      await sql`DELETE FROM user_roles WHERE user_id=${id}`.execute(transaction);
      await sql`DELETE FROM users WHERE id=${id}`.execute(transaction);
    });
    return record;
  }
}
function mapRow(row: Row): User {
  return {
    email: row.email,
    frappeApiKeyConfigured: Boolean(row.frappe_api_key_ciphertext),
    frappeApiSecretConfigured: Boolean(row.frappe_api_secret_ciphertext),
    frappeAuthenticatedUser: row.frappe_authenticated_user,
    frappeEmployeeCode: row.frappe_employee_code,
    frappeLastCheckedAt: nullableTimestamp(row.frappe_last_checked_at),
    frappeLastVerifiedAt: nullableTimestamp(row.frappe_last_verified_at),
    frappeVerificationStatus: row.frappe_verification_status,
    id: Number(row.id),
    isProtected: Boolean(row.is_protected),
    name: row.name,
    role: row.role,
    status: row.status,
    uuid: row.uuid
  };
}

type FrappeCredentialWrite = {
  apiKeyCiphertext: string | null;
  apiSecretCiphertext: string | null;
  verificationStatus: UserFrappeVerificationStatus;
};

function nullableTimestamp(value: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
