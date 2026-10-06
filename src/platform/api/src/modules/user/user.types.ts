import type { Kysely } from "kysely";
import type { TechMediaDatabase } from "../../database/schema.js";

export type UserStatus = "active" | "inactive" | "suspended";
export type UserFrappeVerificationStatus = "live" | "offline" | "unverified";
export type User = {
  email: string;
  frappeApiKeyConfigured: boolean;
  frappeApiSecretConfigured: boolean;
  frappeAuthenticatedUser: string | null;
  frappeEmployeeCode: string | null;
  frappeLastCheckedAt: string | null;
  frappeLastVerifiedAt: string | null;
  frappeVerificationStatus: UserFrappeVerificationStatus;
  id: number;
  isProtected: boolean;
  name: string;
  role: string;
  status: UserStatus;
  uuid: string;
};
export type UserSavePayload = {
  email: string;
  frappeApiKey?: string | undefined;
  frappeApiSecret?: string | undefined;
  frappeEmployeeCode?: string | undefined;
  name: string;
  password?: string | undefined;
  roleId?: number | undefined;
  status: UserStatus;
};
export type UserProfile = Pick<User, "email" | "id" | "name" | "uuid">;
export type UserProfileSavePayload = { email: string; name: string; password?: string | undefined };
export type UserListFilters = { search?: string };
export type UserReference = Pick<User, "email" | "id" | "name" | "uuid">;
export type UserFrappeCredentials = {
  apiKey: string;
  apiSecret: string;
  authenticatedUser: string | null;
  employeeCode: string | null;
  lastCheckedAt: string | null;
  lastVerifiedAt: string | null;
  verificationStatus: UserFrappeVerificationStatus;
};
export type UserFrappeImportPayload = {
  email: string;
  name: string;
};
export type UserFrappeImportResult = {
  created: boolean;
  temporaryPassword: string | null;
  user: User;
};
export type UserContext = {
  actorEmail: string;
  authorize: (permission: string) => Promise<void>;
  database: Kysely<TechMediaDatabase>;
};
