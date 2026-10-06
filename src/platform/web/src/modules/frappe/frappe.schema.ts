import { z } from "zod";

const credential = z.string().trim().max(2_000);
const baseUrl = z
  .string()
  .trim()
  .min(1, "Frappe URL is required.")
  .max(500)
  .url("Enter a valid Frappe URL.");

export const frappeConnectionSchema = z
  .object({
    appKey: credential,
    appSecret: credential,
    baseUrl,
    connectionName: z
      .string()
      .trim()
      .min(2, "Connection name must contain at least 2 characters.")
      .max(160),
    enabled: z.boolean(),
    saveToEnvironment: z.boolean().refine(Boolean, "Select Save in .env to persist these settings.")
  })
  .refine((value) => Boolean(value.appKey) === Boolean(value.appSecret), {
    message: "Enter both the app key and app secret, or leave both blank to keep them.",
    path: ["appKey"]
  });

export const frappeConnectionVerificationSchema = z
  .object({
    appKey: credential,
    appSecret: credential,
    baseUrl
  })
  .refine((value) => Boolean(value.appKey) === Boolean(value.appSecret), {
    message: "Enter both the app key and app secret, or leave both blank to use the saved values.",
    path: ["appKey"]
  });
