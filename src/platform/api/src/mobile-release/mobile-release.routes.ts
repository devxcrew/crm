import { readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

const manifestName = "latest.json";

export function registerMobileReleaseRoutes(app: FastifyInstance, storageRoot: string): void {
  const root = resolve(storageRoot);

  app.get("/mobile/release/latest.json", (_request, reply) => sendManifest(root, reply));
  app.get("/mobile/update", (_request, reply) => sendManifest(root, reply));
  app.get("/mobile/update/latest.json", (_request, reply) => sendManifest(root, reply));

  app.get("/mobile/release/:file", (request, reply) => sendApk(root, request, reply));
  app.get("/mobile/update/:file", (request, reply) => sendApk(root, request, reply));
}

async function sendManifest(root: string, reply: FastifyReply) {
  const manifest = await readReleaseFile(root, manifestName);
  if (!manifest) return reply.code(404).send({ error: "No mobile release is available." });
  return reply
    .type("application/json; charset=utf-8")
    .header("cache-control", "no-cache")
    .send(manifest);
}

async function sendApk(root: string, request: FastifyRequest, reply: FastifyReply) {
  const file = basename((request.params as { file: string }).file);
  if (!/^TechMedia-\d+\.\d+\.\d+\.apk$/u.test(file)) {
    return reply.code(404).send({ error: "Release file not found." });
  }
  const apk = await readReleaseFile(root, file);
  if (!apk) return reply.code(404).send({ error: "Release file not found." });
  return reply
    .type("application/vnd.android.package-archive")
    .header("content-disposition", `attachment; filename="${file}"`)
    .header("cache-control", "public, max-age=300")
    .send(apk);
}

async function readReleaseFile(root: string, name: string): Promise<Buffer | undefined> {
  try {
    return await readFile(join(root, name));
  } catch (error) {
    if (isNotFound(error)) return undefined;
    throw error;
  }
}

function isNotFound(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}
