import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function read(path) {
  return readFile(new URL(path, root), "utf8");
}

function envValues(source) {
  return Object.fromEntries(
    source
      .split(/\r?\n/u)
      .map((line) => line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/u))
      .filter(Boolean)
      .map((match) => [match[1], match[2]])
  );
}

test("each client deployment sample tracks the repository image version", async () => {
  const packageJson = JSON.parse(await read("package.json"));
  for (const client of ["techmedia", "rainbow"]) {
    const deployment = envValues(await read(`.container/${client}/.env.example`));
    assert.equal(deployment.CLIENT_IMAGE_TAG, packageJson.version);
  }
});

test("each client updater rebuilds only its app services and waits for health", async () => {
  for (const client of ["techmedia", "rainbow"]) {
    const update = await read(`.container/${client}/update.sh`);
    assert.match(update, /compose build api web/u);
    assert.match(update, /compose run --rm --no-deps api npm run db:migrate/u);
    assert.match(update, /compose run --rm --no-deps api npm run db:seed/u);
    assert.match(update, /compose up --detach --no-deps api web/u);
    assert.match(update, /wait_for_healthy api/u);
    assert.match(update, /wait_for_healthy web/u);
    assert.match(update, /docker inspect/u);
  }
});

test("version bumps keep both deployment samples synchronized", async () => {
  const releaseTool = await read("tools/repository-release.mjs");

  assert.match(releaseTool, /updateDeploymentReleaseContract\(nextVersion\)/u);
  assert.match(releaseTool, /\["techmedia", "rainbow"\]/u);
  assert.match(releaseTool, /CLIENT_IMAGE_TAG/u);
});
