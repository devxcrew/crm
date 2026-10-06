export const standardDeskPath = "/app/crm/overview";

export function canAccessAdministratorSettings(role: string | undefined) {
  return role === "super-admin";
}

export function applicationEntryPath(role: string | undefined) {
  return role === "super-admin" ? "/app/identity/users" : standardDeskPath;
}
