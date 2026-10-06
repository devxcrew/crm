import { chmod, lstat, mkdir, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const codexHome = process.env.CODEX_HOME?.trim() || join(homedir(), ".codex");

export async function secureCodexCredentials() {
  await mkdir(codexHome, { mode: 0o700, recursive: true });
  await securePath(codexHome);
}

async function securePath(path: string): Promise<void> {
  const stats = await lstat(path);
  if (stats.isSymbolicLink()) return;

  if (stats.isDirectory()) {
    await chmod(path, 0o700);
    const entries = await readdir(path);
    await Promise.all(entries.map((entry) => securePath(join(path, entry))));
    return;
  }

  await chmod(path, stats.mode & 0o700);
}
