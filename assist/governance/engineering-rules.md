# Engineering Rules

- Keep TypeScript strict and imports package-public.
- Use one module directory per owned capability.
- Do not centralize entity CRUD in shared helpers.
- Keep route, service, repository, migration, seed, types, and frontend workspace responsibilities
  explicit.
- Protect system records in backend services, not only in the UI.
- Treat `.env` values as the runtime authority.
- Avoid hard delete for protected identity records.
- Preserve dirty worktrees and report unrelated failures separately.
- Verification reports must name every command run and every live check skipped.
