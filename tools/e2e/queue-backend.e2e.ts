import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp } from "../../src/platform/api/src/app.js";
import { signAuthToken } from "../../src/platform/api/src/auth/jwt.js";
import { getPlatformDatabase } from "../../src/platform/api/src/database/platform-database.js";
import { QueueManagerService } from "../../src/platform/api/src/modules/queue-manager/queue-manager.service.js";

const app = await createApp();
const service = new QueueManagerService();
const idempotencyKey = `queue-e2e:${randomUUID()}`;
const token = signAuthToken({
  email: "queue-e2e@techmedia.test",
  userId: "queuee2e",
  userType: "super_admin"
});
const headers = { authorization: `Bearer ${token}` };

try {
  await app.ready();

  const databaseSwitch = await app.inject({
    headers,
    method: "PUT",
    payload: { backend: "database" },
    url: "/admin/queue/settings/backend"
  });
  assert.equal(databaseSwitch.statusCode, 200);
  assert.equal(databaseSwitch.json().data.backend, "database");

  const first = await service.enqueue({
    idempotencyKey,
    jobName: "queue.e2e.probe",
    payload: { repository: "techmedia" },
    queueName: "e2e",
    sourceModule: "platform.queue-manager"
  });
  const duplicate = await service.enqueue({
    idempotencyKey,
    jobName: "queue.e2e.probe",
    payload: { repository: "techmedia" },
    queueName: "e2e",
    sourceModule: "platform.queue-manager"
  });
  assert.ok(first);
  assert.equal(duplicate?.id, first.id, "Database queue did not enforce idempotency.");

  const cancelled = await service.cancelJob(first.id);
  assert.equal(cancelled?.status, "cancelled");

  const redisSwitch = await app.inject({
    headers,
    method: "PUT",
    payload: { backend: "bullmq-redis" },
    url: "/admin/queue/settings/backend"
  });
  if (redisSwitch.statusCode === 200) {
    assert.equal(redisSwitch.json().data.backend, "bullmq-redis");
    const restored = await app.inject({
      headers,
      method: "PUT",
      payload: { backend: "database" },
      url: "/admin/queue/settings/backend"
    });
    assert.equal(restored.statusCode, 200);
  } else {
    const settings = await app.inject({
      headers,
      method: "GET",
      url: "/admin/queue/settings"
    });
    assert.equal(settings.statusCode, 200);
    assert.equal(settings.json().data.backend, "database");
  }

  console.log("Techmedia queue backend E2E passed", {
    database: true,
    redis: redisSwitch.statusCode === 200 ? "connected" : "unavailable-guarded"
  });
} finally {
  await getPlatformDatabase()
    .deleteFrom("queue_jobs")
    .where("idempotency_key", "=", idempotencyKey)
    .execute();
  await app.close();
}
