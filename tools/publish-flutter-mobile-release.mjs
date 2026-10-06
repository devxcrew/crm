#!/usr/bin/env node

import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const flutterRoot = join(root, "apps", "techmedia_flutter");
const args = process.argv.slice(2);
const baseUrl = args.find((arg) => arg.startsWith("--base-url="))?.slice("--base-url=".length);
const releaseFilePrefix = args
  .find((arg) => arg.startsWith("--release-file-prefix="))
  ?.slice("--release-file-prefix=".length);
const releaseNotes = args.find((arg) => arg.startsWith("--release-notes="))?.slice("--release-notes=".length);
const mandatory = args.includes("--mandatory");
const sourceApk = join(flutterRoot, "build", "app", "outputs", "flutter-apk", "app-release.apk");
const releaseRoot = join(root, "storage", "mobile", "release");

if (!baseUrl || !/^https:\/\/.+/u.test(baseUrl) || !releaseFilePrefix || !releaseNotes) {
  fail(
    "Usage: node tools/publish-flutter-mobile-release.mjs --base-url=https://crm.example.com/mobile/update --release-file-prefix=client-crm --release-notes=\"Client CRM mobile update\" [--mandatory]"
  );
}
if (!existsSync(sourceApk))
  fail("Build the Flutter release APK before publishing it to portal storage.");

const version = readVersion();
const versionCode = readVersionCode();
const apkName = `${releaseFilePrefix}-${version}.apk`;
const apkPath = join(releaseRoot, apkName);
const apk = readFileSync(sourceApk);

mkdirSync(releaseRoot, { recursive: true });
cpSync(sourceApk, apkPath);
writeFileSync(
  join(releaseRoot, "latest.json"),
  `${JSON.stringify(
    {
      apkUrl: `${baseUrl.replace(/\/$/u, "")}/${apkName}`,
      mandatory,
      notes: releaseNotes,
      releasedAt: new Date().toISOString(),
      sha256: createHash("sha256").update(apk).digest("hex"),
      versionCode,
      versionName: version
    },
    null,
    2
  )}\n`,
  "utf8"
);

console.log(`Portal APK: ${apkPath}`);
console.log(`Portal manifest: ${join(releaseRoot, "latest.json")}`);

function readVersion() {
  const source = readFileSync(join(flutterRoot, "pubspec.yaml"), "utf8");
  const value = /^version:\s*(\d+\.\d+\.\d+)\+\d+\s*$/mu.exec(source)?.[1];
  if (!value) fail("Flutter pubspec version is invalid.");
  return value;
}

function readVersionCode() {
  const source = readFileSync(join(flutterRoot, "pubspec.yaml"), "utf8");
  const value = /^version:\s*\d+\.\d+\.\d+\+(\d+)\s*$/mu.exec(source)?.[1];
  if (!value) fail("Flutter pubspec build number is invalid.");
  return Number(value);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
