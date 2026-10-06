import { sql, type Kysely } from "kysely";
import type { TechMediaDatabase } from "../../database/schema.js";

export const messagingMigrations = [
  { key: "messaging.conversations-v1" },
  { key: "messaging.members-v1" },
  { key: "messaging.messages-v1" },
  { key: "messaging.receipts-reactions-v3" },
  { key: "messaging.utc-timestamps-v2" }
] as const;

/**
 * Phase 1 schema for the Business Messaging Engine. Conversations, members,
 * and messages are the local source of truth; message binaries and realtime
 * state never live here. Migrations are idempotent and record their keys in
 * schema_migrations so existing databases upgrade safely.
 */
export async function migrateMessagingModule(database: Kysely<TechMediaDatabase>) {
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS conversations (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(8) NOT NULL UNIQUE,
        type VARCHAR(24) NOT NULL DEFAULT 'DIRECT',
        title VARCHAR(180) NULL,
        avatar VARCHAR(500) NULL,
        created_by INT NOT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'active',
        last_message_id INT NULL,
        last_message_sequence INT NOT NULL DEFAULT 0,
        metadata_json LONGTEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX conversations_type_created (type, created_at),
        INDEX conversations_last_message (last_message_id),
        CONSTRAINT conversations_creator_fk FOREIGN KEY (created_by) REFERENCES users(id)
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS conversation_members (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        conversation_id INT NOT NULL,
        user_id INT NOT NULL,
        role VARCHAR(16) NOT NULL DEFAULT 'MEMBER',
        joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        left_at DATETIME NULL,
        muted BOOLEAN NOT NULL DEFAULT FALSE,
        archived BOOLEAN NOT NULL DEFAULT FALSE,
        notification_level VARCHAR(16) NOT NULL DEFAULT 'all',
        last_read_message_id INT NULL,
        UNIQUE KEY conversation_members_conversation_user (conversation_id, user_id),
        INDEX conversation_members_user (user_id),
        CONSTRAINT conversation_members_conversation_fk
          FOREIGN KEY (conversation_id) REFERENCES conversations(id),
        CONSTRAINT conversation_members_user_fk FOREIGN KEY (user_id) REFERENCES users(id)
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS messages (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(8) NOT NULL UNIQUE,
        conversation_id INT NOT NULL,
        sender_id INT NOT NULL,
        type VARCHAR(24) NOT NULL DEFAULT 'TEXT',
        content LONGTEXT NOT NULL,
        sequence_number INT NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'SENT',
        reply_to_message_id INT NULL,
        forwarded_from_message_id INT NULL,
        thread_id INT NULL,
        client_message_id VARCHAR(80) NULL,
        metadata_json LONGTEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        edited_at DATETIME NULL,
        deleted_at DATETIME NULL,
        UNIQUE KEY messages_conversation_sequence (conversation_id, sequence_number),
        UNIQUE KEY messages_conversation_client (conversation_id, client_message_id),
        INDEX messages_conversation_created (conversation_id, created_at),
        INDEX messages_sender (sender_id),
        INDEX messages_reply_to (reply_to_message_id),
        CONSTRAINT messages_conversation_fk FOREIGN KEY (conversation_id) REFERENCES conversations(id),
        CONSTRAINT messages_sender_fk FOREIGN KEY (sender_id) REFERENCES users(id)
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS message_receipts (
        message_id INT NOT NULL,
        user_id INT NOT NULL,
        delivered_at DATETIME NULL,
        read_at DATETIME NULL,
        PRIMARY KEY (message_id, user_id),
        INDEX message_receipts_user (user_id, read_at),
        CONSTRAINT message_receipts_message_fk FOREIGN KEY (message_id) REFERENCES messages(id),
        CONSTRAINT message_receipts_user_fk FOREIGN KEY (user_id) REFERENCES users(id)
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS message_reactions (
        message_id INT NOT NULL,
        user_id INT NOT NULL,
        emoji VARCHAR(32) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (message_id, user_id),
        INDEX message_reactions_message (message_id),
        CONSTRAINT message_reactions_message_fk FOREIGN KEY (message_id) REFERENCES messages(id),
        CONSTRAINT message_reactions_user_fk FOREIGN KEY (user_id) REFERENCES users(id)
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);
  await migrateExistingMessagingTimestamps(database);
  await database
    .insertInto("schema_migrations")
    .ignore()
    .values(messagingMigrations.map(({ key }) => ({ name: key })))
    .execute();
}

async function migrateExistingMessagingTimestamps(database: Kysely<TechMediaDatabase>) {
  const migrationKey = "messaging.utc-timestamps-v2";
  const applied = await database
    .selectFrom("schema_migrations")
    .select("id")
    .where("name", "=", migrationKey)
    .executeTakeFirst();
  if (applied) return;
  await database.transaction().execute(async (transaction) => {
    await sql
      .raw("UPDATE conversations SET created_at = DATE_SUB(created_at, INTERVAL 330 MINUTE), updated_at = DATE_SUB(updated_at, INTERVAL 330 MINUTE)")
      .execute(transaction);
    await sql
      .raw("UPDATE conversation_members SET joined_at = DATE_SUB(joined_at, INTERVAL 330 MINUTE), left_at = CASE WHEN left_at IS NULL THEN NULL ELSE DATE_SUB(left_at, INTERVAL 330 MINUTE) END")
      .execute(transaction);
    await sql
      .raw("UPDATE messages SET created_at = DATE_SUB(created_at, INTERVAL 330 MINUTE), updated_at = DATE_SUB(updated_at, INTERVAL 330 MINUTE), edited_at = CASE WHEN edited_at IS NULL THEN NULL ELSE DATE_SUB(edited_at, INTERVAL 330 MINUTE) END, deleted_at = CASE WHEN deleted_at IS NULL THEN NULL ELSE DATE_SUB(deleted_at, INTERVAL 330 MINUTE) END")
      .execute(transaction);
    await transaction.insertInto("schema_migrations").values({ name: migrationKey }).execute();
  });
}
