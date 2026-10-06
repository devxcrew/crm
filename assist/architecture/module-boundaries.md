# Module Boundaries

## Composition Root

`src/platform/api/src/app.ts` may register only:

- `identity.user`
- `identity.role`
- `identity.permission`
- `identity.user-role`
- `identity.role-permission`
- `app.branding`
- `settings.frappe`
- `notification.inbox`
- `crm.enquiry`
- `hr.request`
- `estimate`
- `quotation`
- `ishop`
- `ai.honey`
- `messaging`

The composition root orders modules and injects the public live-Frappe enquiry gateway. It must not
contain entity SQL or business workflows.

Messaging owns local conversations, membership, message persistence, and authenticated realtime
delivery. Identity remains the source of truth for all contact users.

## Backend Leaves

Identity leaves own their routes, services, repositories, migrations, seeds, and types.
Relationships use persisted IDs and database foreign keys. Settings has routes and services but no
repository, migration, seed, or table because its application connection comes from `.env`.

Branding owns the singleton application title and tagline. Its read contract is public for login
surfaces. Its update contract requires the `super-admin` role.

Notifications own recipient-scoped inbox and outbox records. They store delivery metadata and a
live Frappe enquiry identifier, never a local CRM record.

Honey owns actor-scoped AI conversations and messages. Its provider-neutral gateway uses only
OpenAI-compatible environment configuration. Content writing uses bounded strategist, writer, and
editor workers and performs no external side effects.
Honey also owns the persisted global availability setting. Only a system administrator can change
it. Disabled TEMA routes reject new chat work, and the desk hides chat and mascot surfaces.
Honey owns separate administrator controls for web and mobile pet visibility. Each device can also
hide its local pet through the shared responsive side menu without disabling TEMA chat.
Agent Connector and skill administration require the protected `super-admin` role in API routes
and desk navigation. Business agent chat may use enabled skills without exposing their editor.

CRM owns routes, validation, UI contracts, and enquiry workflow behavior. All CRM records are read
or written through the Frappe gateway; adding a CRM repository, migration, seed, cache table, or
local source of truth is prohibited.

HR owns Staff Request routes, validation, UI contracts, and access rules. Staff Request records and
approval comments are read and written through the Frappe gateway. HR must not add local business
tables, repositories, migrations, seeds, or caches.

iShop owns its CRM routes and UI contracts. LogicX iShop and ERPNext catalog records remain
on the connected Frappe site. iShop must not add local commerce tables or caches.

## Frontend Leaves

Estimate owns its routes, validation, UI contracts, and Frappe document mapping. It must remain a
live-Frappe leaf with no repository, migration, seed, cache table, or local business persistence.

Quotation owns its routes, validation, UI contracts, enquiry-linked Frappe document mapping, and
public enquiry-tab component. It must remain a live-Frappe leaf with no repository, migration,
seed, cache table, or local business persistence.

Frontend modules own their workspaces, forms, lists, services, hooks, schemas, and types. The app
desk composes Identity, Settings, CRM navigation, and the recipient notification inbox; CRM enquiry detail consumes the public
Estimate and Quotation tab components.

Docs owns the authenticated documentation index, MDX article rendering, and documentation
navigation. Authored guides stay in the Docs module. The Changelog page reads
`assist/documentation/CHANGELOG.md` directly and does not keep a second release log.

The messaging frontend owns the contact picker, conversation list, message thread, composer, and
WebSocket lifecycle. Its messaging contact contract exposes only active Identity user references;
Identity remains the source of truth and administration data is not exposed.

The internal Framework workspace supplies infrastructure contracts. The internal UI workspace
supplies presentation primitives. CRM does not import parent-repository source or compose
other product packages.
