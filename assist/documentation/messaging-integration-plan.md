# Business Messaging Engine — Integration Plan

## 1. Findings from Repository Inspection

CRM is a standalone, single-client application: one Fastify API
(`src/platform/api`), one React desk (`src/platform/web`), and one MariaDB
database selected by `DB_NAME` (`src/platform/api/src/database`).

### Reused infrastructure

| Concern | Existing owner | Reuse for messaging |
| --- | --- | --- |
| Users / identity | `identity.user` (table `users`) | Conversation members reference `users.id`. No second user system. |
| Authentication | JWT Bearer + `identityContext(request)` (`src/auth`) | Reused verbatim for REST and WebSocket auth. |
| Authorization | `can` / `authorize(permission)` + role-permission join | Conversation access is enforced server-side in services. |
| HTTP API convention | `registerContractRoute` + Zod schemas + `ok`/`fail` envelope | All messaging REST routes follow it. |
| Module composition | `defineModule` + `registerModules` + `PlatformModuleDependencies` | `messaging` registers routes + WebSocket in the same shape. |
| Database | Kysely + MariaDB, single `schema.ts`, ordered migrations with `schema_migrations` keys | New tables follow the existing migration + schema pattern. |
| Events / queues / storage | Framework contracts only (`EventPublisher`, `QueueAdapter`, `StorageAdapter`), no live implementations | Realtime bus is a new local adapter; storage adapter added in Phase 4. |
| Notifications | `notification.inbox` (`notifications`, `notification_outbox`) + `NotificationPublisher.enqueue` | Message/mention notifications reuse this publisher in later phases. |
| AI / agents | `ai.honey` (TEMA) provider-neutral gateway (`HoneyModelGateway`) | Agentic messaging (Phase 6) reuses the honey gateway; it is not duplicated. |
| UI | `@codexsun/ui` (design system, `ApplicationLayout`, lucide icons), TanStack Router + React Query, Tailwind v4 | Messaging UI uses the design system and existing layout. |

### Gaps found

- No WebSocket infrastructure exists. `@fastify/websocket` (and `ws`) are not
  installed. Phase 1 adds them to `@crm/platform-api` only.
- No Redis exists. Realtime in Phase 1 is an in-memory bus behind a
  `RealtimeBus` interface; a Redis pub/sub adapter (multi-server, Phase 7)
  replaces the implementation without touching business services.
- No task module exists (CRM/Estimate/Quotation/HR/iShop are live-Frappe
  leaves and own no local business tables). The messaging engine therefore
  introduces a local `messaging` capability only; task creation is not
  implemented before the existing task surface is confirmed.
- No file storage is wired. Attachment upload (Phase 4) is deferred behind the
  framework `StorageAdapter` contract.
- `recordAuditEvent` currently logs to console; messaging audit events use it
  now and harden it later.

## 2. New Module: `messaging`

Backend leaf: `src/platform/api/src/modules/messaging/`

```
messaging/
├── index.ts                 # public exports
├── messaging.module.ts      # defineModule key: "messaging"
├── messaging.migration.ts   # conversations, conversation_members, messages
├── messaging.types.ts       # domain types + Zod wire schemas
├── messaging.repositories.ts# repository interfaces + Kysely/InMemory impls
├── message-sequence.ts      # per-conversation monotonic sequence allocation
├── conversation.service.ts  # create/list/get, members, access checks
├── message.service.ts       # persist, idempotent send, list, read cursor
├── connection-manager.ts    # user -> connections -> subscriptions
├── realtime-bus.ts          # in-memory pub/sub (Redis adapter later)
├── realtime.gateway.ts      # transport-agnostic typed event handling
├── ws-adapter.ts            # @fastify/websocket transport (auth + frame I/O)
└── messaging.routes.ts      # REST HTTP routes
```

Frontend leaf: `src/platform/web/src/modules/messaging/`

```
messaging/
├── index.ts
├── messaging.types.ts
├── messaging.services.ts    # REST client (apiGet/apiPost)
├── messaging.hooks.ts       # React Query hooks
├── messaging.client.ts      # WebSocket client (auth + envelope + reconnect)
└── MessagingWorkspace.tsx   # conversation list + thread + composer
```

### Database changes (Phase 1)

New tables (registered in `schema.ts`, migrated by `messaging.migration.ts`,
recorded in `schema_migrations`):

- `conversations` — id, uuid, type (`DIRECT|GROUP|TEAM|PROJECT|CUSTOMER|SUPPORT|SYSTEM`),
  title, avatar, created_by, created_at, updated_at, last_message_id,
  last_message_sequence, status, metadata_json.
- `conversation_members` — conversation_id, user_id, role
  (`OWNER|ADMIN|MEMBER|VIEWER`), joined_at, left_at, muted, archived,
  notification_level, last_read_message_id, unique(conversation_id, user_id).
- `messages` — id, uuid, conversation_id, sender_id, type, content, sequence_number,
  status (`SENDING|SENT|DELIVERED|READ|FAILED`), reply_to_message_id,
  forwarded_from_message_id, thread_id, client_message_id, metadata_json,
  created_at, updated_at, edited_at, deleted_at. Unique index
  `(conversation_id, client_message_id)` for send idempotency.

Indexes: `(conversation_id, sequence_number)` unique, `(conversation_id, created_at)`,
`conversation_members(user_id)`, `conversation_members(conversation_id)`,
`messages(sender_id)`, `messages(reply_to_message_id)`.

### Realtime architecture (Phase 1)

```
Browser/Web client ──WebSocket──> @fastify/websocket (ws-adapter)
        │
        ▼
  RealtimeGateway (transport-agnostic)
  ├── auth (JWT verify -> user)
  ├── conversation.subscribe / unsubscribe
  ├── message.send -> MessageService.send -> persist -> bus.publish(message.created)
  ├── sync.request -> messages after sequence
  │
  ▼
  RealtimeBus (in-memory pub/sub; Redis adapter in Phase 7)
  │
  ├── conversation fan-out -> subscribed connections of members
  └── presence/typing (Phase 2)
```

Business logic lives in services. The WebSocket adapter only authenticates the
transport, validates the typed envelope, and delegates to the gateway. The
database remains the source of truth; a message is persisted before it is
broadcast. `client_message_id` makes sends idempotent across retries.

### Dependencies

- `@fastify/websocket` and `ws` (added to `@crm/platform-api`).
- No new runtime dependency for the web client (browser WebSocket).

## 3. Phase Sequencing Against the Existing App

| Phase | Scope | Touch points in existing code |
| --- | --- | --- |
| 1 | conversations, members, messages, WebSocket auth, connection manager, persistence, basic send/receive, sync.request | `app.ts`, `schema.ts`, `techmedia-database.ts`, boundary/lifecycle check tools, `platform-api` deps |
| 2 | sent/delivered/read, unread, typing, presence, reconnect, offline sync | messaging module only + notification publisher |
| 3 | reply, forward, reaction, edit, delete, search | messaging module (+ `search` behind an index, later dedicated engine) |
| 4 | attachments, images, audio, voice | framework `StorageAdapter` implementation |
| 5 | mentions, assignment, task extraction, priority, rich cards | existing task surface confirmed first |
| 6 | agentic messaging | `ai.honey` gateway reused; permission + confirmation rules |
| 7 | Redis pub/sub, multi-server, push, performance, observability | `RealtimeBus`/queue adapter swap only |

## 4. Definition of Done for Phase 1

- Users authenticate to REST and WebSocket with the existing JWT.
- Users can create DIRECT/GROUP conversations and add members.
- Messages persist with a per-conversation monotonic sequence.
- `client_message_id` prevents duplicate sends.
- Subscribed connections receive `message.created` in realtime.
- `sync.request` returns messages after a known sequence.
- No business logic lives in the WebSocket handler.
- Existing application modules remain untouched and checks pass.