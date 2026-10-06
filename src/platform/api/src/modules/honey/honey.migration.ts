import { sql, type Kysely } from "kysely";
import type { TechMediaDatabase } from "../../database/schema.js";

export const honeyMigrations = [
  { key: "ai.honey.content-v1" },
  { key: "ai.honey.archive-v1" },
  { key: "ai.honey.global-availability-v1" },
  { key: "ai.honey.pet-platform-visibility-v1" }
] as const;

export async function migrateHoneyModule(database: Kysely<TechMediaDatabase>) {
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS ai_honey_threads (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, uuid CHAR(36) NOT NULL UNIQUE,
    actor_user_id INT NOT NULL, title VARCHAR(240) NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX ai_honey_threads_actor_updated (actor_user_id, updated_at),
    CONSTRAINT ai_honey_threads_actor_fk FOREIGN KEY (actor_user_id) REFERENCES users(id)
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);
  await sql
    .raw("ALTER TABLE ai_honey_threads ADD COLUMN IF NOT EXISTS archived_at DATETIME NULL")
    .execute(database);
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS ai_honey_skills (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, name VARCHAR(80) NOT NULL UNIQUE,
    description VARCHAR(500) NOT NULL, instructions TEXT NOT NULL, enabled TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);
  await database
    .insertInto("ai_honey_skills")
    .ignore()
    .values([
      {
        name: "business-content-writer",
        enabled: true,
        description: "Create accurate business content for CRM channels.",
        instructions:
          "Define audience and intent, preserve supplied facts, flag unsupported claims, and return publish-ready copy."
      },
      {
        name: "crm-communication",
        enabled: true,
        description: "Draft clear CRM follow-ups without sending them.",
        instructions:
          "Use concise professional language, include a next action, and never claim a message was sent."
      },
      {
        name: "estimate-quotation-review",
        enabled: true,
        description: "Review estimate and quotation wording.",
        instructions:
          "Check clarity, scope, assumptions, exclusions, and calls to action without inventing prices or terms."
      }
    ])
    .execute();
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS ai_honey_settings (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, setting_key VARCHAR(80) NOT NULL UNIQUE,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);
  await database
    .insertInto("ai_honey_settings")
    .ignore()
    .values([
      { enabled: true, setting_key: "global-availability" },
      { enabled: true, setting_key: "pet-mobile-visible" },
      { enabled: true, setting_key: "pet-web-visible" }
    ])
    .execute();
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS ai_honey_messages (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, uuid CHAR(36) NOT NULL UNIQUE,
    thread_uuid CHAR(36) NOT NULL, actor_user_id INT NOT NULL, role VARCHAR(16) NOT NULL,
    body MEDIUMTEXT NOT NULL, metadata_json TEXT NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX ai_honey_messages_thread_created (thread_uuid, created_at),
    CONSTRAINT ai_honey_messages_thread_fk FOREIGN KEY (thread_uuid) REFERENCES ai_honey_threads(uuid),
    CONSTRAINT ai_honey_messages_actor_fk FOREIGN KEY (actor_user_id) REFERENCES users(id)
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);
  await database
    .insertInto("schema_migrations")
    .ignore()
    .values(honeyMigrations.map(({ key }) => ({ name: key })))
    .execute();
}
