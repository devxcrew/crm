#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const env = { ...loadDotEnv(), ...process.env };
const services = {
  "platform-api": {
    color: "\x1b[36m",
    healthUrl: `${env.PLATFORM_API_URL ?? "http://127.0.0.1:7050"}/health`,
    label: "api",
    preflight: "platform-api"
  },
  "platform-web": {
    color: "\x1b[32m",
    healthUrl: `http://127.0.0.1:${env.PLATFORM_WEB_PORT ?? "7060"}/`,
    label: "web",
    preflight: "platform-web"
  }
};
const reset = "\x1b[0m";
const children = new Set();
const restartTimers = new Set();
let stopping = false;

console.log("\nTECHMEDIA Platform runtime");
await startStack();

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    stopChildren();
    process.exit(0);
  });
}

function startService(serviceName) {
  const service = services[serviceName];
  const child = spawn(process.execPath, ["tools/preflight.mjs", service.preflight], {
    cwd: root,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  children.add(child);
  child.stdout.on("data", (chunk) => writeServiceLines(service, chunk));
  child.stderr.on("data", (chunk) => writeServiceLines(service, chunk));
  child.on("exit", (code) => {
    children.delete(child);
    if (stopping) return;

    const exitCode = code ?? 1;
    console.error(`${service.color}[${service.label}]${reset} exited with code ${exitCode}`);
    console.log(`${service.color}[${service.label}]${reset} restarting in 1 second`);
    const timer = setTimeout(() => {
      restartTimers.delete(timer);
      if (!stopping) startService(serviceName);
    }, 1_000);
    restartTimers.add(timer);
  });

  return child;
}

async function startStack() {
  console.log(`  - ${services["platform-api"].label}`);
  startService("platform-api");
  await waitForHealthyUrl(services["platform-api"].healthUrl, "Platform API", 90_000);

  console.log(`  - ${services["platform-web"].label}`);
  startService("platform-web");
  await waitForHealthyUrl(services["platform-web"].healthUrl, "Platform Web", 30_000);
  console.log("  ok Platform API and Web are ready\n");
  monitorStackHealth();
}

async function waitForHealthyUrl(url, label, timeoutMs) {
  const startedAt = Date.now();
  let lastStatus = "not reachable";

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      lastStatus = `HTTP ${response.status}`;
      if (response.ok) return;
    } catch (error) {
      lastStatus = error instanceof Error ? error.message : String(error);
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }

  console.error(`  x ${label} did not become healthy: ${lastStatus}`);
  stopChildren();
  process.exit(1);
}

function monitorStackHealth() {
  const targets = Object.values(services).map((service) => ({ failures: 0, label: service.label, unavailable: false, url: service.healthUrl }));
  let checking = false;

  setInterval(async () => {
    if (checking || stopping) return;
    checking = true;

    try {
      for (const target of targets) {
        try {
          const response = await fetch(target.url, { signal: AbortSignal.timeout(2_000) });
          target.failures = response.ok ? 0 : target.failures + 1;
        } catch {
          target.failures += 1;
        }

        if (target.failures >= 3 && !target.unavailable) {
          target.unavailable = true;
          console.log(`  - ${target.label} is restarting; the other service remains available`);
        }
        if (target.failures === 0 && target.unavailable) {
          target.unavailable = false;
          console.log(`  ok ${target.label} is ready again`);
        }
      }
    } finally {
      checking = false;
    }
  }, 2_000);
}

function writeServiceLines(service, chunk) {
  for (const rawLine of String(chunk).split(/\r?\n/u)) {
    const line = rawLine.replace(/\u001b\[[0-9;]*m/gu, "").trim();
    if (line) process.stdout.write(`${service.color}[${service.label}]${reset} ${line}\n`);
  }
}

function stopChildren(skipChild) {
  stopping = true;
  for (const timer of restartTimers) clearTimeout(timer);
  restartTimers.clear();
  for (const child of children) {
    if (child === skipChild || child.killed || !child.pid) continue;
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      child.kill("SIGTERM");
    }
  }
}

function loadDotEnv() {
  const path = resolve(root, ".env");
  if (!existsSync(path)) return {};

  const entries = readFileSync(path, "utf8")
    .split(/\r?\n/u)
    .map((line) => line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/u))
    .filter(Boolean)
    .map((match) => [
      match[1].trim(),
      match[2].replace(/^(["'])(.*)\1$/u, "$2")
    ]);

  return Object.fromEntries(entries);
}
