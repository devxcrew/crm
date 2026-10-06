import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import Fastify from "fastify";
import { registerMobileReleaseRoutes } from "../src/mobile-release/mobile-release.routes.js";

test("serves the current mobile release manifest and APK", async () => {
  const root = await mkdtemp(join(tmpdir(), "techmedia-mobile-release-"));
  const app = Fastify();
  try {
    await writeFile(join(root, "latest.json"), '{"versionName":"1.0.1"}\n');
    await writeFile(join(root, "TechMedia-1.0.1.apk"), "apk-bytes");
    registerMobileReleaseRoutes(app, root);

    const manifest = await app.inject("/mobile/release/latest.json");
    assert.equal(manifest.statusCode, 200);
    assert.equal(manifest.headers["cache-control"], "no-cache");
    assert.equal(manifest.body, '{"versionName":"1.0.1"}\n');

    const publicManifest = await app.inject("/mobile/update/latest.json");
    assert.equal(publicManifest.statusCode, 200);
    assert.equal(publicManifest.body, manifest.body);

    const apk = await app.inject("/mobile/release/TechMedia-1.0.1.apk");
    assert.equal(apk.statusCode, 200);
    assert.equal(apk.headers["content-type"], "application/vnd.android.package-archive");
    assert.equal(apk.body, "apk-bytes");

    const publicApk = await app.inject("/mobile/update/TechMedia-1.0.1.apk");
    assert.equal(publicApk.statusCode, 200);
    assert.equal(publicApk.body, apk.body);

    const missing = await app.inject("/mobile/release/other.apk");
    assert.equal(missing.statusCode, 404);
  } finally {
    await app.close();
    await rm(root, { force: true, recursive: true });
  }
});
