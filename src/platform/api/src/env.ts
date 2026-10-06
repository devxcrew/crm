import { loadEnv } from "@codexsun/framework/env";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
  AUTH_MODE: z.enum(["cookie", "jwt", "hybrid"]).default("jwt"),
  APP_BRAND_NAME: z.string().trim().min(1).max(80),
  APP_BRAND_TAGLINE: z.string().trim().min(1).max(180),
  PLATFORM_API_PORT: z.coerce.number().int().positive(),
  PLATFORM_API_URL: z.string().url("PLATFORM_API_URL must be a valid URL"),
  PLATFORM_WEB_PORT: z.coerce.number().int().positive().default(7060),
  PLATFORM_WEB_ORIGIN: z.string().url("PLATFORM_WEB_ORIGIN must be a valid URL"),
  PLATFORM_WEB_ORIGINS: z.string().default(""),
  PLATFORM_WEB_HEALTH_URL: z.union([z.literal(""), z.string().url()]).default(""),
  DB_HOST: z.string().default("127.0.0.1"),
  DB_PORT: z.coerce.number().int().positive(),
  DB_USER: z.string().min(1, "DB_USER is required"),
  DB_PASSWORD: z.string(),
  DB_DRIVER: z.enum(["mariadb", "mysql2"]).default("mariadb"),
  DB_NAME: z.string().min(1, "DB_NAME is required"),
  TECHMEDIA_DB_FRESH_ON_START: z.enum(["0", "1"]).default("0"),
  TECHMEDIA_DB_RESET_CONFIRM: z.string().default(""),
  TECHMEDIA_ALLOW_PRODUCTION_DB_RESET: z.enum(["0", "1"]).default("0"),
  TECHMEDIA_ENV_FILE_PATH: z.string().default(""),
  TECHMEDIA_INTEGRATION_ENCRYPTION_KEY: z.string().default(""),
  MESSAGE_MEDIA_STORAGE_ROOT: z.string().min(1).default("./storage/messaging"),
  MOBILE_RELEASE_STORAGE_ROOT: z.string().min(1).default("./storage/mobile/release"),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().default(""),
  MESSAGE_MEDIA_MAX_UPLOAD_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(10 * 1024 * 1024),
  DEV_AUTO_LOGIN: z.enum(["0", "1"]).default("0"),
  INITIAL_ADMIN_EMAIL: z.string().default("admin@admin.com"),
  INITIAL_ADMIN_NAME: z.string().default(""),
  INITIAL_ADMIN_PASSWORD: z.string().default(""),
  FRAPPE_APP_KEY: z.string().default(""),
  FRAPPE_APP_SECRET: z.string().default(""),
  FRAPPE_BASE_URL: z.string().default(""),
  FRAPPE_CONNECTION_NAME: z.string().default("Frappe"),
  FRAPPE_ENABLED: z.enum(["0", "1"]).default("1"),
  FRAPPE_LAST_CHECKED_AT: z.string().default(""),
  FRAPPE_LAST_VERIFIED_AT: z.string().default(""),
  FRAPPE_UPDATED_AT: z.string().default(""),
  FRAPPE_VERIFICATION_STATUS: z.enum(["live", "offline", "unverified"]).default("unverified"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  AI_PROVIDER: z.enum(["openai", "openrouter", "opencode", "compatible"]).default("openai"),
  AI_API_KEY: z.string().default(""),
  AI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  AI_MODEL: z.string().default("gpt-5.6-terra"),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(120000)
});

export const env = loadEnv(envSchema);
