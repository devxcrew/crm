# CRM Assist

CRM is a standalone, single-client application. Its runtime contains:

- Identity: users, roles, permissions, user-role assignments, and role-permission assignments.
- Notifications: recipient inbox and durable outbox delivery events for internal workspace alerts.
- Settings: the `.env` Frappe connection and per-user Frappe credentials stored on users.
- CRM: live enquiry workflows backed by Frappe. CRM owns no local business tables.
- Estimate: live Estimate workflows backed by Frappe. Estimate owns no local business tables.
- Quotation: live Quotation workflows linked to enquiries and backed by Frappe. Quotation owns no
  local business tables.

CRM uses one MariaDB database selected by `DB_NAME`. It stores Identity, notifications, and
other application-owned records listed in the data strategy. The app has one login and one desk.

Read `AGENT-GUIDE.md`, then the relevant architecture and governance rules before changing code.
