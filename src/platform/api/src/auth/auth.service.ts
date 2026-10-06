import { getTechMediaDatabase } from "../database/techmedia-database.js";
import { frappeUserAuthenticationContract } from "../modules/frappe/index.js";
import { signAuthToken } from "./jwt.js";
import { verifyPassword } from "./password-hash.js";

export class AuthService {
  async login(input: { email?: string; password?: string }) {
    const email = input.email?.trim().toLowerCase() ?? "";
    const password = input.password ?? "";
    if (!email || !password) return null;

    const database = getTechMediaDatabase();
    const user = await database
      .selectFrom("users")
      .select(["id", "uuid", "email", "name", "password_hash", "role", "status"])
      .where("email", "=", email)
      .executeTakeFirst();
    if (!user || user.status !== "active" || !verifyPassword(password, user.password_hash)) {
      return null;
    }

    const permissions = await database
      .selectFrom("user_roles as userRole")
      .innerJoin("roles as role", "role.id", "userRole.role_id")
      .innerJoin("role_permissions as rolePermission", "rolePermission.role_id", "role.id")
      .innerJoin("permissions as permission", "permission.id", "rolePermission.permission_id")
      .select("permission.key")
      .where("userRole.user_id", "=", user.id)
      .where("userRole.status", "=", "active")
      .where("role.status", "=", "active")
      .where("rolePermission.status", "=", "active")
      .where("permission.status", "=", "active")
      .distinct()
      .orderBy("permission.key")
      .execute();
    const permissionKeys = permissions.map(({ key }) => key);
    const frappe = await frappeUserAuthenticationContract(database).statusForLogin(Number(user.id));
    const accessToken = signAuthToken({
      email: user.email,
      ...(frappe.employeeCode ? { frappeEmployeeCode: frappe.employeeCode } : {}),
      ...(frappe.authenticatedUser ? { frappeUser: frappe.authenticatedUser } : {}),
      name: user.name,
      permissions: permissionKeys,
      role: user.role,
      userId: user.uuid
    });

    return {
      accessToken,
      email: user.email,
      frappeAuthenticated: frappe.status === "live",
      frappeAuthenticatedUser: frappe.authenticatedUser,
      frappeEmployeeCode: frappe.employeeCode,
      frappeConnectionStatus: frappe.status,
      name: user.name,
      permissions: permissionKeys,
      role: user.role
    };
  }
}
