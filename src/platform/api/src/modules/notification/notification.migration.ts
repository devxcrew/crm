import { sql, type Kysely } from "kysely";
import type { TechMediaDatabase } from "../../database/schema.js";

export const notificationMigrations = [
  { key: "notification.inbox.outbox-v1" },
  { key: "notification.inbox.fcm-device-tokens-v2" },
  { key: "notification.inbox.fcm-device-token-uuid-v3" },
  { key: "notification.inbox.notification-uuid-v4" }
] as const;

export async function migrateNotificationModule(database: Kysely<TechMediaDatabase>) {
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS notifications (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(32) NOT NULL UNIQUE,
        recipient_user_id INT NOT NULL,
        actor_user_id INT NULL,
        event_type VARCHAR(32) NOT NULL,
        title VARCHAR(220) NOT NULL,
        body VARCHAR(1000) NOT NULL,
        resource_id VARCHAR(180) NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'unread',
        read_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX notifications_recipient_status_created (recipient_user_id, status, created_at),
        CONSTRAINT notifications_recipient_user_fk FOREIGN KEY (recipient_user_id) REFERENCES users(id),
        CONSTRAINT notifications_actor_user_fk FOREIGN KEY (actor_user_id) REFERENCES users(id)
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);
  await sql
    .raw("ALTER TABLE notifications MODIFY COLUMN uuid VARCHAR(36) NOT NULL")
    .execute(database);
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS notification_device_tokens (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(32) NOT NULL UNIQUE,
        user_id INT NOT NULL,
        token VARCHAR(512) NOT NULL UNIQUE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX notification_device_tokens_user_updated (user_id, updated_at),
        CONSTRAINT notification_device_tokens_user_fk FOREIGN KEY (user_id) REFERENCES users(id)
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);
  await sql
    .raw(
      "ALTER TABLE notification_device_tokens MODIFY COLUMN uuid VARCHAR(36) NOT NULL"
    )
    .execute(database);
  await sql
    .raw(
      `CREATE TABLE IF NOT EXISTS notification_outbox (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(32) NOT NULL UNIQUE,
        notification_id INT NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'pending',
        attempts INT NOT NULL DEFAULT 0,
        delivered_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX notification_outbox_status_created (status, created_at),
        CONSTRAINT notification_outbox_notification_fk FOREIGN KEY (notification_id) REFERENCES notifications(id)
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    .execute(database);
  await database
    .insertInto("schema_migrations")
    .ignore()
    .values(notificationMigrations.map(({ key }) => ({ name: key })))
    .execute();
}
