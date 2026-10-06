import type { ColumnType, Generated } from "kysely";

export type TimestampColumn = ColumnType<
  Date,
  Date | string | undefined,
  Date | string | undefined
>;

export type NullableTimestampColumn = ColumnType<
  Date | null,
  Date | string | null | undefined,
  Date | string | null | undefined
>;

export type NullableStringColumn = ColumnType<
  string | null,
  string | null | undefined,
  string | null | undefined
>;

export type DefaultedStringColumn<Value extends string> = ColumnType<
  Value,
  Value | undefined,
  Value | undefined
>;

export type DefaultedNumberColumn = ColumnType<number, number | undefined, number | undefined>;

export type UsersTable = {
  created_at: TimestampColumn;
  email: string;
  frappe_api_key_ciphertext: NullableStringColumn;
  frappe_api_secret_ciphertext: NullableStringColumn;
  frappe_authenticated_user: NullableStringColumn;
  frappe_employee_code: NullableStringColumn;
  frappe_last_checked_at: NullableTimestampColumn;
  frappe_last_verified_at: NullableTimestampColumn;
  frappe_verification_status: DefaultedStringColumn<"live" | "offline" | "unverified">;
  id: Generated<number>;
  is_protected: boolean | number;
  name: string;
  password_hash: string;
  role: string;
  status: "active" | "inactive" | "suspended";
  updated_at: TimestampColumn;
  uuid: string;
};

export type RolesTable = {
  created_at: TimestampColumn;
  description: string;
  id: Generated<number>;
  is_protected: boolean | number;
  key: string;
  label: string;
  status: "active" | "inactive";
  updated_at: TimestampColumn;
  uuid: string;
};

export type PermissionsTable = {
  created_at: TimestampColumn;
  description: string;
  id: Generated<number>;
  is_protected: boolean | number;
  key: string;
  label: string;
  status: "active" | "inactive";
  updated_at: TimestampColumn;
  uuid: string;
};

export type UserRolesTable = {
  created_at: TimestampColumn;
  id: Generated<number>;
  is_protected: boolean | number;
  role_id: number;
  status: "active" | "inactive";
  updated_at: TimestampColumn;
  user_id: number;
  uuid: string;
};

export type RolePermissionsTable = {
  created_at: TimestampColumn;
  id: Generated<number>;
  is_protected: boolean | number;
  permission_id: number;
  role_id: number;
  status: "active" | "inactive";
  updated_at: TimestampColumn;
  uuid: string;
};

export type SchemaMigrationsTable = {
  applied_at: TimestampColumn;
  id: Generated<number>;
  name: string;
};

export type NotificationsTable = {
  actor_user_id: number | null;
  body: string;
  created_at: TimestampColumn;
  event_type: "assignment" | "chat" | "comment" | "reply" | "status";
  id: Generated<number>;
  read_at: NullableTimestampColumn;
  recipient_user_id: number;
  resource_id: string;
  status: DefaultedStringColumn<"read" | "unread">;
  title: string;
  uuid: string;
};

export type NotificationOutboxTable = {
  attempts: DefaultedNumberColumn;
  created_at: TimestampColumn;
  delivered_at: NullableTimestampColumn;
  id: Generated<number>;
  notification_id: number;
  status: DefaultedStringColumn<"delivered" | "pending">;
  uuid: string;
};

export type NotificationDeviceTokensTable = {
  created_at: TimestampColumn;
  id: Generated<number>;
  token: string;
  updated_at: TimestampColumn;
  user_id: number;
  uuid: string;
};

export type AiHoneyThreadsTable = {
  actor_user_id: number;
  archived_at: NullableTimestampColumn;
  created_at: TimestampColumn;
  id: Generated<number>;
  title: string;
  updated_at: TimestampColumn;
  uuid: string;
};

export type AiHoneyMessagesTable = {
  actor_user_id: number;
  body: string;
  created_at: TimestampColumn;
  id: Generated<number>;
  metadata_json: string;
  role: "assistant" | "user";
  thread_uuid: string;
  uuid: string;
};
export type AiHoneySkillsTable = {
  created_at: TimestampColumn;
  description: string;
  enabled: boolean | number;
  id: Generated<number>;
  instructions: string;
  name: string;
  updated_at: TimestampColumn;
};
export type AiHoneySettingsTable = {
  enabled: boolean | number;
  id: Generated<number>;
  setting_key: string;
  updated_at: TimestampColumn;
};

export type AppBrandingSettingsTable = {
  id: number;
  tagline: string;
  title: string;
  updated_at: TimestampColumn;
};

export type FrappeConnectionSettingsTable = {
  api_key_ciphertext: NullableStringColumn;
  api_secret_ciphertext: NullableStringColumn;
  base_url: string;
  connection_name: string;
  enabled: boolean | number;
  id: number;
  last_checked_at: NullableTimestampColumn;
  last_verified_at: NullableTimestampColumn;
  updated_at: TimestampColumn;
  verification_status: DefaultedStringColumn<"live" | "offline" | "unverified">;
};

export type ConversationType =
  "DIRECT" | "GROUP" | "TEAM" | "PROJECT" | "CUSTOMER" | "SUPPORT" | "SYSTEM";
export type ConversationStatus = "active" | "archived" | "deleted";
export type ConversationMemberRole = "ADMIN" | "MEMBER" | "OWNER" | "VIEWER";
export type MessageType =
  | "TEXT"
  | "IMAGE"
  | "VIDEO"
  | "AUDIO"
  | "VOICE"
  | "DOCUMENT"
  | "FILE"
  | "SYSTEM"
  | "TASK"
  | "ORDER"
  | "INVOICE"
  | "AGENT"
  | "CONTACT"
  | "LOCATION";
export type MessageStatus = "DELIVERED" | "FAILED" | "READ" | "SENDING" | "SENT";

export type ConversationsTable = {
  avatar: NullableStringColumn;
  created_at: TimestampColumn;
  created_by: number;
  id: Generated<number>;
  last_message_id: number | null;
  last_message_sequence: DefaultedNumberColumn;
  metadata_json: string;
  status: DefaultedStringColumn<ConversationStatus>;
  title: NullableStringColumn;
  type: ConversationType;
  updated_at: TimestampColumn;
  uuid: string;
};

export type ConversationMembersTable = {
  archived: boolean | number;
  conversation_id: number;
  id: Generated<number>;
  joined_at: TimestampColumn;
  last_read_message_id: number | null;
  left_at: NullableTimestampColumn;
  muted: boolean | number;
  notification_level: DefaultedStringColumn<"all" | "mentions" | "muted">;
  role: ConversationMemberRole;
  user_id: number;
};

export type MessagesTable = {
  client_message_id: NullableStringColumn;
  content: string;
  conversation_id: number;
  created_at: TimestampColumn;
  deleted_at: NullableTimestampColumn;
  edited_at: NullableTimestampColumn;
  forwarded_from_message_id: number | null;
  id: Generated<number>;
  metadata_json: string;
  reply_to_message_id: number | null;
  sender_id: number;
  sequence_number: number;
  status: DefaultedStringColumn<MessageStatus>;
  thread_id: number | null;
  type: MessageType;
  updated_at: TimestampColumn;
  uuid: string;
};

export type MessageReceiptsTable = {
  delivered_at: NullableTimestampColumn;
  message_id: number;
  read_at: NullableTimestampColumn;
  user_id: number;
};

export type MessageReactionsTable = {
  created_at: TimestampColumn;
  emoji: string;
  message_id: number;
  user_id: number;
};

export type TechMediaDatabase = {
  app_branding_settings: AppBrandingSettingsTable;
  frappe_connection_settings: FrappeConnectionSettingsTable;
  ai_honey_messages: AiHoneyMessagesTable;
  ai_honey_settings: AiHoneySettingsTable;
  ai_honey_skills: AiHoneySkillsTable;
  ai_honey_threads: AiHoneyThreadsTable;
  conversation_members: ConversationMembersTable;
  conversations: ConversationsTable;
  messages: MessagesTable;
  message_reactions: MessageReactionsTable;
  message_receipts: MessageReceiptsTable;
  notification_outbox: NotificationOutboxTable;
  notification_device_tokens: NotificationDeviceTokensTable;
  notifications: NotificationsTable;
  permissions: PermissionsTable;
  role_permissions: RolePermissionsTable;
  roles: RolesTable;
  schema_migrations: SchemaMigrationsTable;
  user_roles: UserRolesTable;
  users: UsersTable;
};
