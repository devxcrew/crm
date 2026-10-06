# Single-Client Application

CRM serves one organization with one application configuration and one MariaDB database.
Signed-in users share the application desk, and requests use each user's signed token and persisted
role assignments for authorization. Application settings come from `.env`, while user-specific
Frappe credentials belong to Identity.
