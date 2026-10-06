import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const serverEntry = resolve(root, "dist/platform/api/server.js");
const envPath = resolve(root, ".env");

assert.ok(existsSync(serverEntry), "Build the application before running the runtime smoke test.");
assert.ok(existsSync(envPath), "A configured root .env is required for the runtime smoke test.");
process.loadEnvFile(envPath);

const email = process.env.INITIAL_ADMIN_EMAIL?.trim();
const password = process.env.INITIAL_ADMIN_PASSWORD?.trim();
assert.ok(email, "INITIAL_ADMIN_EMAIL is required for the runtime smoke test.");
assert.ok(password, "INITIAL_ADMIN_PASSWORD is required for the runtime smoke test.");

for (let cycle = 1; cycle <= 2; cycle += 1) {
  await smokeCycle(cycle);
}

console.info(
  "Runtime smoke passed: two API boots, fixed single-client context, health, unauthorized session, administrator login, authenticated session, and logout."
);

async function smokeCycle(cycle) {
  const port = await availablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const output = [];
  const child = spawn(process.execPath, [serverEntry], {
    cwd: root,
    env: {
      ...process.env,
      DEV_AUTO_LOGIN: "0",
      NODE_ENV: "test",
      PLATFORM_API_PORT: String(port),
      PLATFORM_API_URL: baseUrl,
      PLATFORM_WEB_ORIGIN: "http://127.0.0.1:7060"
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  child.stdout.on("data", (chunk) => output.push(String(chunk)));
  child.stderr.on("data", (chunk) => output.push(String(chunk)));

  try {
    await waitForHealth(baseUrl, child, output);

    const health = await request(baseUrl, "/health");
    assert.equal(health.response.status, 200);
    assert.equal(health.body.success, true);

    const anonymousSession = await request(baseUrl, "/auth/session");
    assert.equal(anonymousSession.response.status, 401);
    assert.equal(anonymousSession.body.error?.code, "AUTH_SESSION_EXPIRED");

    const login = await request(baseUrl, "/auth/login", {
      body: JSON.stringify({ email, password }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    assert.equal(login.response.status, 200);
    assert.equal(login.body.success, true);
    assert.equal(login.body.data?.email, email.toLowerCase());
    assert.ok(login.body.data?.accessToken);
    assert.equal(login.body.data?.role, "admin");
    assert.ok(login.body.data?.permissions?.includes("identity.user.view"));
    assert.ok(login.body.data?.permissions?.includes("settings.frappe.view"));

    const session = await request(baseUrl, "/auth/session", {
      headers: { authorization: `Bearer ${login.body.data.accessToken}` }
    });
    assert.equal(session.response.status, 200);
    assert.equal(session.body.data?.authenticated, true);
    assert.equal(session.body.data?.email, email.toLowerCase());
    assert.equal(session.body.data?.role, "admin");
    assert.ok(session.body.data?.permissions?.includes("identity.user.view"));
    assert.ok(session.body.data?.permissions?.includes("settings.frappe.view"));

    const frappeSettings = await request(baseUrl, "/settings/frappe", {
      headers: { authorization: `Bearer ${login.body.data.accessToken}` }
    });
    assert.equal(frappeSettings.response.status, 200);

    if (cycle === 1 && login.body.data.frappeAuthenticated) {
      const authorization = { authorization: `Bearer ${login.body.data.accessToken}` };
      const crmOverview = await request(baseUrl, "/crm/enquiries/overview", {
        headers: authorization,
        timeoutMs: 30_000
      });
      assert.equal(crmOverview.response.status, 200);
      assert.equal(crmOverview.body.success, true);
      const estimates = await request(baseUrl, "/estimates", {
        headers: authorization,
        timeoutMs: 30_000
      });
      assert.equal(estimates.response.status, 200);
      assert.equal(estimates.body.success, true);
      console.info("Live Frappe CRM overview and Estimate list smoke passed.");
    } else if (cycle === 1) {
      console.info(
        "Live Frappe business smoke skipped: administrator credentials are not verified."
      );
    }

    const logout = await request(baseUrl, "/auth/logout", { method: "POST" });
    assert.equal(logout.response.status, 200);
    assert.equal(logout.body.data?.loggedOut, true);
    console.info(`Runtime smoke cycle ${cycle} passed on ${baseUrl}.`);
  } finally {
    await stop(child);
  }
}

async function request(baseUrl, path, init) {
  const { timeoutMs = 5_000, ...requestInit } = init ?? {};
  const response = await fetch(`${baseUrl}${path}`, {
    ...requestInit,
    signal: AbortSignal.timeout(timeoutMs)
  });
  return { body: await response.json(), response };
}

async function waitForHealth(baseUrl, child, output) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30_000) {
    if (child.exitCode !== null) {
      throw new Error(`API exited before becoming healthy.\n${output.join("")}`);
    }
    try {
      const response = await fetch(`${baseUrl}/health`, {
        signal: AbortSignal.timeout(1_000)
      });
      if (response.ok) return;
    } catch {
      // The API can refuse connections while the process is still booting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 200));
  }
  throw new Error(`API did not become healthy.\n${output.join("")}`);
}

function availablePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      server.close((error) => (error ? reject(error) : resolvePort(address.port)));
    });
  });
}

async function stop(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolveExit) => child.once("exit", resolveExit)),
    new Promise((resolveWait) => setTimeout(resolveWait, 5_000))
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}
