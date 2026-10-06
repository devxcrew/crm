#!/usr/bin/env node

import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const appRoot = join(root, "apps", "techmedia_flutter");
const command = process.argv[2];
const extraArgs = process.argv.slice(3);
const mobileProfile = readMobileProfile(extraArgs);
const flutterArgs = extraArgs.filter((argument) => !argument.startsWith("--mobile-profile="));
const mobileConfig = loadMobileConfiguration(mobileProfile);
const supported = new Set(["build-debug", "build-release", "release", "run"]);

if (!command || !supported.has(command)) {
  fail(
  "Usage: node tools/flutter-mobile.mjs <run|build-debug|build-release|release> [--mobile-profile=<name>] [Flutter options]"
  );
}

if (command === "run") {
  runFlutter(["run", ...dartDefines(repositoryVersion()), ...flutterArgs]);
}
if (command === "build-debug") buildApk("debug");
if (command === "build-release") buildApk("release");
if (command === "release") {
  buildApk("release");
  runNode([
    join(root, "tools", "publish-flutter-mobile-release.mjs"),
    `--base-url=${mobileConfig.releaseBaseUrl}`,
    `--release-file-prefix=${mobileConfig.releaseFilePrefix}`,
    `--release-notes=${mobileConfig.brandName} mobile update`,
    ...(extraArgs.includes("--mandatory") ? ["--mandatory"] : [])
  ]);
}

function buildApk(mode) {
  const version = repositoryVersion();
  runFlutter([
    "build",
    "apk",
    `--${mode}`,
    ...dartDefines(version)
  ]);
  if (mode === "release") copyVersionedRelease(version);
}

function copyVersionedRelease(version) {
  const outputDirectory = join(appRoot, "build", "app", "outputs", "flutter-apk");
  const source = join(outputDirectory, "app-release.apk");
  const target = join(outputDirectory, `${mobileConfig.releaseFilePrefix}-v${version}.apk`);
  if (!existsSync(source)) fail(`Flutter release APK is missing: ${source}`);
  copyFileSync(source, target);
  console.log(`Versioned APK: ${target}`);
}

function runFlutter(args) {
  const executable = flutterExecutable();
  const result =
    platform() === "win32"
      ? spawnSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", executable, ...args], {
          cwd: appRoot,
          env: { ...process.env, ...mobileConfig.environment },
          stdio: "inherit"
        })
      : spawnSync(executable, args, {
          cwd: appRoot,
          env: { ...process.env, ...mobileConfig.environment },
          stdio: "inherit"
        });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function runNode(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: "inherit" });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function flutterExecutable() {
  if (process.env.FLUTTER_BIN?.trim()) return process.env.FLUTTER_BIN.trim();
  if (platform() === "win32") {
    const localFlutter = join(homedir(), "development", "flutter", "bin", "flutter.bat");
    if (existsSync(localFlutter)) return localFlutter;
    return "flutter.bat";
  }
  return "flutter";
}

function repositoryVersion() {
  const value = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
  if (typeof value !== "string" || !/^\d+\.\d+\.\d+$/u.test(value))
    fail("Invalid repository version.");
  return value;
}

function dartDefines(version) {
  return [
    `--dart-define=APP_VERSION=${version}`,
    `--dart-define=APP_BRAND=${mobileConfig.mobileBrandName}`,
    `--dart-define=API_URL=${mobileConfig.apiUrl}`,
    `--dart-define=RELEASE_MANIFEST_URL=${mobileConfig.releaseManifestUrl}`,
    `--dart-define=NATIVE_CHANNEL_PREFIX=${mobileConfig.androidApplicationId}`,
    `--dart-define=RELEASE_FILE_PREFIX=${mobileConfig.releaseFilePrefix}`,
    `--dart-define=APP_LOGO_ASSET=${mobileConfig.logoAsset}`
  ];
}

function loadMobileConfiguration(profile) {
  const environmentPath = join(root, ".env");
  if (!existsSync(environmentPath)) fail("Create the root .env file before building the mobile app.");
  const values = parseEnvironment(readFileSync(environmentPath, "utf8"));
  if (profile) {
    const profilePath = join(root, "mobile-profiles", `${profile}.env`);
    if (!existsSync(profilePath)) fail(`Mobile profile is missing: ${profilePath}`);
    for (const [key, value] of parseEnvironment(readFileSync(profilePath, "utf8"))) {
      values.set(key, value);
    }
  }
  const required = (key) => {
    const value = values.get(key)?.trim();
    if (!value) fail(`${key} must be set in the root .env file.`);
    return value;
  };
  const brandName = required("APP_BRAND_NAME");
  const mobileBrandName = required("MOBILE_APP_BRAND_NAME");
  const apiUrl = required("MOBILE_API_URL");
  const releaseBaseUrl = required("MOBILE_RELEASE_BASE_URL");
  const releaseManifestUrl = required("MOBILE_RELEASE_MANIFEST_URL");
  const androidApplicationId = required("ANDROID_APPLICATION_ID");
  const releaseFilePrefix = required("MOBILE_RELEASE_FILE_PREFIX");
  const logoAsset = required("MOBILE_LOGO_ASSET");
  const androidBrandAsset = required("MOBILE_ANDROID_BRAND_ASSET");
  if (!/^https?:\/\//u.test(apiUrl) || !/^https?:\/\//u.test(releaseBaseUrl) || !/^https?:\/\//u.test(releaseManifestUrl)) {
    fail("MOBILE_API_URL and mobile release URLs must use HTTP or HTTPS.");
  }
  if (!/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/u.test(androidApplicationId)) {
    fail("ANDROID_APPLICATION_ID must be a valid Android application ID.");
  }
  if (!/^[a-z][a-z0-9_]*$/u.test(androidBrandAsset)) {
    fail("MOBILE_ANDROID_BRAND_ASSET must be a lowercase Android resource profile name.");
  }
  return {
    androidBrandAsset,
    androidApplicationId,
    apiUrl,
    brandName,
    mobileBrandName,
    environment: {
      ANDROID_APPLICATION_ID: androidApplicationId,
      APP_BRAND_NAME: brandName,
      MOBILE_ANDROID_BRAND_ASSET: androidBrandAsset
    },
    logoAsset,
    releaseBaseUrl,
    releaseFilePrefix,
    releaseManifestUrl
  };
}

function readMobileProfile(argumentsList) {
  const profileArgument = argumentsList.find((argument) =>
    argument.startsWith("--mobile-profile=")
  );
  if (!profileArgument) return undefined;
  const profile = profileArgument.slice("--mobile-profile=".length).trim();
  if (!/^[a-z][a-z0-9-]*$/u.test(profile)) {
    fail("--mobile-profile must use lowercase letters, digits, and hyphens.");
  }
  return profile;
}

function unquote(value) {
  return value.replace(/^['"]|['"]$/gu, "");
}

function parseEnvironment(source) {
  const values = new Map();
  for (const line of source.split(/\r?\n/u)) {
    const match = /^([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/u.exec(line);
    if (match?.[1]) values.set(match[1], unquote(match[2] ?? ""));
  }
  return values;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
