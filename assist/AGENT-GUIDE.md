# CRM Agent Guide

## Required Reading

Before repository work, read:

1. `assist/README.md`
2. `assist/governance/engineering-rules.md`
3. `assist/architecture/module-boundaries.md`
4. `assist/architecture/data-strategy.md`
5. `assist/documentation/project-inventory.md`

## Runtime Contract

- CRM is standalone and single-client.
- The API and web app use one login and one application desk.
- `DB_NAME` is the only application database.
- Identity owns local users, roles, permissions, and their two assignment tables. Notifications own
  the recipient inbox and outbox delivery tables.
- Settings reads the application Frappe connection from `.env`; per-user encrypted credentials
  belong to the user identity record.
- Settings, CRM, Estimate, and Quotation own no local business tables. CRM enquiries, Estimate records, and
  Quotation records are read and written through live Frappe contracts using the signed-in user's
  verified credentials.
- The internal `packages/framework` and `packages/ui` workspaces may be consumed only through
  public package exports.
- Core and other product packages are not composed into CRM.

## Change Rules

- Preserve unrelated worktree changes.
- Keep entity behavior inside its module leaf.
- Use fixed route contracts and explicit Zod schemas.
- Keep environment configuration in `.env`; do not add silent database or endpoint fallbacks.
- Migrations must upgrade existing databases safely and record their keys in `schema_migrations`.
- Seeds must be repeatable. Protected administrator creation is controlled by `INITIAL_ADMIN_*`.
- Never claim live MariaDB or Frappe verification unless those systems were actually exercised.
- Run typecheck, lint, build, boundary, and database lifecycle checks before completion.
