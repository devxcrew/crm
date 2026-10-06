# CRM

CRM is a standalone, single-client application connected to live Frappe. It is a
self-contained npm monorepo: the application, Framework runtime, and UI design system all live in
this repository.

The runtime contains:

- Identity: users, roles, permissions, user roles, and role permissions.
- Settings: one `.env` Frappe connection plus per-user Frappe credentials on user records.
- CRM: live Frappe enquiry workflows with no local CRM business database.
- Estimate: live Frappe Estimate list, create, and update workflows with no local business database.

CRM uses one MariaDB database configured by `DB_NAME`; only Identity is persisted locally.
Settings, CRM, and Estimate own no tables. The app has one `/login` route and one `/app` desk.
Application code consumes only the public exports of the internal `packages/framework` and
`packages/ui` workspaces; no parent-folder package is required for install, development, build, or
deployment.

The workspace uses only the repository-root `node_modules` and `dist` directories. Framework
runtime output is written to `dist/packages/framework`; API and web output is written to
`dist/platform/api` and `dist/platform/web`.

## Development

Copy `.env.example` to `.env`, fill the database, JWT, encryption, administrator, and Frappe
settings, then run:

```sh
npm install
npm run dev
```

Default endpoints:

- API: `http://127.0.0.1:7050`
- Web: `http://127.0.0.1:7060`

Database commands:

```sh
npm run db:migrate
npm run db:seed
npm run db:migrations:list
```

`db:drop` and `dbmigrate:fresh` require the explicit reset guard documented in `.env.example`.

## Local Docker deployment

Each client has a fully isolated deployment under `.container`:

- `.container/techmedia` uses only `techmedia-*` containers, volumes, and network.
- `.container/rainbow` uses only `rainbow-*` containers, volumes, and network.

For the selected client, copy `.env.example` to `.env`, set its secrets, then run its scripts:

```sh
bash .container/techmedia/setup.sh
bash .container/techmedia/update.sh

bash .container/rainbow/setup.sh
bash .container/rainbow/update.sh
```

`setup.sh` starts that client stack. `update.sh` builds the API and web images, runs safe database
migrations and repeatable seeds, then recreates only its API and web containers and waits for their
health checks. It never removes MariaDB or any Docker volume.
The two stacks can run in parallel because their names, ports, networks, databases, and volumes
are different. See the client README in each folder for its URLs and configuration.

## Verification

```sh
npm run check
npm run build
npm run dependencies:check
npm run test:e2e:runtime
```

The runtime smoke test uses the configured MariaDB and administrator credentials, starts the built
API twice, and verifies health, anonymous-session rejection, login, authenticated session recovery,
logout, and restart persistence.

Read `assist/AGENT-GUIDE.md` before changing architecture or module ownership.
