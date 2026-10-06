import assert from "node:assert/strict";
import test from "node:test";
import { createApiApp, registerHealthRoute } from "@codexsun/framework/api";
import { registerContractRoute } from "@codexsun/framework/http";
import { z } from "zod";

const cookieSecret = "framework-test-cookie-secret-32-bytes";

async function createTestApp() {
  return createApiApp({
    appName: "framework-test",
    cookieSecret,
    corsOrigins: [],
    environment: "development"
  });
}

test("contract routes return a validation envelope for invalid request input", async (t) => {
  const app = await createTestApp();
  t.after(() => app.close());

  registerContractRoute(app, {
    method: "POST",
    schemas: {
      body: z.object({ name: z.string().min(1) }).strict(),
      response: z.object({ name: z.string() })
    },
    url: "/contracts/request",
    handler: ({ body }) => body
  });

  const response = await app.inject({
    method: "POST",
    payload: {},
    url: "/contracts/request"
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, "VALIDATION_ERROR");
});

test("contract routes hide invalid server responses behind an internal error", async (t) => {
  const app = await createTestApp();
  t.after(() => app.close());

  registerContractRoute(app, {
    method: "GET",
    schemas: {
      response: z.object({ value: z.string() })
    },
    url: "/contracts/response",
    handler: () => ({ value: 42 })
  });

  const response = await app.inject({
    method: "GET",
    url: "/contracts/response"
  });

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.json().error, {
    code: "INTERNAL_ERROR",
    message: "Something went wrong"
  });
});

test("correlation context trims the request header and includes it in the envelope", async (t) => {
  const app = await createTestApp();
  t.after(() => app.close());

  const response = await app.inject({
    headers: {
      "x-correlation-id": " request-1 "
    },
    method: "GET",
    url: "/"
  });

  assert.equal(response.headers["x-correlation-id"], "request-1");
  assert.equal(response.json().meta.correlationId, "request-1");
});

test("health checks continue after an exception and return a down envelope", async (t) => {
  const app = await createTestApp();
  t.after(() => app.close());

  registerHealthRoute(app, [
    {
      name: "database",
      check() {
        throw new Error("connection details must not leak");
      }
    },
    {
      name: "storage",
      check() {
        return { status: "ok" };
      }
    }
  ]);

  const response = await app.inject({
    method: "GET",
    url: "/health"
  });
  const body = response.json();

  assert.equal(response.statusCode, 503);
  assert.equal(body.data.status, "down");
  assert.equal(body.data.checks.database.status, "down");
  assert.equal(body.data.checks.storage.status, "ok");
  assert.doesNotMatch(JSON.stringify(body), /connection details/);
});
