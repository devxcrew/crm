import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { AppError } from "@codexsun/framework/errors";
import { env } from "../env.js";

const encryptionVersion = "v1";

export function encryptIntegrationCredential(value: string, namespace: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", credentialKey(namespace), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [
    encryptionVersion,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url")
  ].join(".");
}

export function decryptIntegrationCredential(value: string, namespace: string) {
  const [version, iv, tag, ciphertext] = value.split(".");
  if (version !== encryptionVersion || !iv || !tag || !ciphertext) {
    throw AppError.conflict("Stored integration credentials use an unsupported encryption format.");
  }
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      credentialKey(namespace),
      Buffer.from(iv, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final()
    ]).toString("utf8");
  } catch {
    throw AppError.conflict(
      "Stored integration credentials could not be decrypted with the configured encryption key."
    );
  }
}

function credentialKey(namespace: string) {
  const operatorKey = env.TECHMEDIA_INTEGRATION_ENCRYPTION_KEY.trim() || env.JWT_SECRET;
  return createHash("sha256").update(`techmedia:${namespace}:${operatorKey}`).digest();
}
