import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { AppError } from "@codexsun/framework/errors";

export type StoredMessageAttachment = {
  contentType: string;
  key: string;
  name: string;
  size: number;
};

export interface MessageMediaStorage {
  read(conversationId: number, key: string): Promise<Buffer | undefined>;
  store(conversationId: number, input: { dataUrl: string; name: string; type: string }): Promise<StoredMessageAttachment>;
}

export class LocalMessageMediaStorage implements MessageMediaStorage {
  private readonly root: string;

  constructor(root: string, private readonly maxBytes: number) {
    this.root = resolve(root);
  }

  async store(conversationId: number, input: { dataUrl: string; name: string; type: string }) {
    const file = decodeDataUrl(input.dataUrl, input.type, this.maxBytes);
    const key = `${randomUUID()}${extension(input.name)}`;
    const folder = join(this.root, String(conversationId));
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, key), file.bytes, { flag: "wx" });
    return { contentType: file.contentType, key, name: safeName(input.name), size: file.bytes.length };
  }

  async read(conversationId: number, key: string) {
    if (!/^[a-f0-9-]{36}(?:\.[a-z0-9]{1,10})?$/iu.test(key)) return undefined;
    try {
      return await readFile(join(this.root, String(conversationId), key));
    } catch (error) {
      if (isNotFound(error)) return undefined;
      throw error;
    }
  }

  async remove(conversationId: number, key: string) {
    await rm(join(this.root, String(conversationId), key), { force: true });
  }
}

function decodeDataUrl(value: string, expectedType: string, maxBytes: number) {
  const match = /^data:([^;,]+);base64,([a-z0-9+/=\s]+)$/iu.exec(value);
  if (!match) throw AppError.validation("Attachment data is invalid.");
  const contentType = match[1]?.toLowerCase() ?? "";
  if (!allowedContentType(contentType) || contentType !== expectedType.toLowerCase()) {
    throw AppError.validation("Attachment type is not allowed.");
  }
  const bytes = Buffer.from(match[2]!.replace(/\s/gu, ""), "base64");
  if (!bytes.length || bytes.length > maxBytes) throw AppError.validation(`Attachments must be ${Math.floor(maxBytes / 1024 / 1024)} MB or smaller.`);
  return { bytes, contentType };
}

function allowedContentType(value: string) {
  return value === "application/pdf" || value.startsWith("image/") || value.startsWith("video/") || value.startsWith("audio/") || value === "text/plain" || value === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

function extension(name: string) { const value = basename(name).match(/\.([a-z0-9]{1,10})$/iu)?.[0] ?? ""; return value.toLowerCase(); }
function safeName(value: string) { return basename(value).split("").map((character) => character.charCodeAt(0) < 32 || "<>:\"/\\|?*".includes(character) ? "_" : character).join("").slice(0, 180) || "attachment"; }
function isNotFound(error: unknown) { return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT"); }
