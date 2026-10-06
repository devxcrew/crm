#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { platform } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { createInterface } from "node:readline";

const root = resolve(import.meta.dirname, "..");
const changelogPath = join(root, "assist", "documentation", "CHANGELOG.md");
const command = process.argv[2];
const args = process.argv.slice(3);

if (
  !command ||
  !["version:show", "version:bump", "check:versions", "github:now"].includes(command)
) {
  console.error(
    "Usage: node tools/repository-release.mjs <version:show|version:bump|check:versions|github:now>"
  );
  process.exit(1);
}

if (command === "version:show") showVersion();
if (command === "version:bump") bumpVersion();
if (command === "check:versions") checkVersions();
if (command === "github:now") await githubNow();

function packageFiles() {
  const rootPackagePath = join(root, "package.json");
  const rootPackage = readJson(rootPackagePath);
  const files = new Set([rootPackagePath]);

  for (const pattern of rootPackage.workspaces ?? []) {
    for (const directory of expandWorkspacePattern(pattern)) {
      const packagePath = join(directory, "package.json");
      if (existsSync(packagePath)) files.add(packagePath);
    }
  }

  return [...files].sort();
}

function expandWorkspacePattern(pattern) {
  let directories = [root];
  for (const part of pattern.split(/[\\/]/u).filter(Boolean)) {
    const next = [];
    for (const directory of directories) {
      if (part === "*") {
        if (!existsSync(directory)) continue;
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
          if (entry.isDirectory()) next.push(join(directory, entry.name));
        }
      } else {
        const candidate = join(directory, part);
        if (existsSync(candidate) && statSync(candidate).isDirectory()) next.push(candidate);
      }
    }
    directories = next;
  }
  return directories;
}

function showVersion() {
  console.log(`${readJson(join(root, "package.json")).name} ${rootVersion()}`);
}

function bumpVersion(titleOverride) {
  const currentVersion = rootVersion();
  const nextVersion = nextPatch(currentVersion);
  const title = titleOverride ?? option("--title") ?? "Version update";
  const databaseUpdate = databaseUpdateMode();

  if (args.includes("--dry-run")) {
    console.log(`Version bump dry run: ${currentVersion} -> ${nextVersion}`);
    console.log(`Title: ${title}`);
    console.log(`Database update: ${databaseUpdate ? "Yes" : "No"}`);
    return;
  }

  for (const file of packageFiles()) updatePackage(file, currentVersion, nextVersion);
  updateLockfile(currentVersion, nextVersion);
  updateFlutterVersion(nextVersion);
  updateDeploymentReleaseContract(nextVersion);
  updateChangelog(nextVersion, title, databaseUpdate);

  console.log(`Bumped ${currentVersion} -> ${nextVersion}`);
  console.log(`Database update: ${databaseUpdate ? "Yes" : "No"}`);
}

function checkVersions() {
  const expected = rootVersion();
  const failures = [];

  for (const file of packageFiles()) {
    const actual = String(readJson(file).version ?? "");
    if (actual !== expected) {
      failures.push(`${relative(root, file)} is ${actual}; expected ${expected}.`);
    }
  }

  const lockPath = join(root, "package-lock.json");
  if (existsSync(lockPath)) {
    const lock = readJson(lockPath);
    if (String(lock.version ?? "") !== expected) {
      failures.push(`package-lock.json is ${lock.version}; expected ${expected}.`);
    }
    if (lock.packages?.[""]?.version && String(lock.packages[""].version) !== expected) {
      failures.push(`package-lock root is ${lock.packages[""].version}; expected ${expected}.`);
    }
  }

  const changelog = readFileSync(changelogPath, "utf8");
  for (const expectedLine of [
    `Current version: ${expected}`,
    `Release tag: v-${expected}`,
    `Changelog label: v ${expected}`,
    `## v-${expected}`
  ]) {
    if (!changelog.includes(expectedLine)) failures.push(`Changelog is missing: ${expectedLine}`);
  }

  const flutterVersion = readFlutterVersion();
  if (flutterVersion.version !== expected || flutterVersion.build !== releaseBuild(expected)) {
    failures.push(
      `apps/techmedia_flutter/pubspec.yaml is ${flutterVersion.version}+${flutterVersion.build}; expected ${expected}+${releaseBuild(expected)}.`
    );
  }

  if (failures.length) {
    console.error(`Version check failed for ${expected}:`);
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }

  console.log(`Version check passed for ${expected}.`);
}

async function githubNow() {
  const dryRun = args.includes("--dry-run");
  let currentVersion = rootVersion();
  let changelogEntry = latestEntry(currentVersion);
  let defaultMessage = releaseSubject(currentVersion, changelogEntry.title);
  const status = git(["status", "--porcelain"], true);
  const files = status ? status.split(/\r?\n/u).filter(Boolean) : [];
  console.log(`\n  Changelog version: ${currentVersion}`);
  console.log(`  Commit subject:    ${defaultMessage}`);
  console.log(`  Uncommitted:       ${files.length} files\n`);

  if (files.length > 0) {
    files.forEach((file) => console.log(`    ${file}`));
    console.log("");
  }

  if (dryRun) {
    console.log(renderReviewBox({ fileCount: files.length, subject: defaultMessage, version: currentVersion }));
    console.log("  Dry run only. No pull, commit, or push was performed.\n");
    return;
  }

  const subject = await withPrompt(async (ask) => {
    console.log(renderReviewBox({ fileCount: files.length, subject: defaultMessage, version: currentVersion }));
    const shouldBump = isYes(await ask("  Bump next version before commit? [y/N]: "));

    if (shouldBump) {
      const titleAnswer = await ask("  Version title [Version update]: ", "Version update");
      const title = titleAnswer.trim() || "Version update";
      const previousVersion = currentVersion;
      bumpVersion(title);
      currentVersion = rootVersion();
      changelogEntry = latestEntry(currentVersion);
      defaultMessage = releaseSubject(currentVersion, changelogEntry.title);
      console.log(`\n  Bumped ${previousVersion} -> ${currentVersion}`);
      console.log(`  Commit subject: ${defaultMessage}\n`);
    }

    const message = await ask(`  Commit message [${defaultMessage}]: `, defaultMessage);
    if (!isYes(await ask("  Continue with pull, commit, and push? [y/N]: "))) {
      throw new Error("Cancelled.");
    }
    return message.trim() || defaultMessage;
  });

  checkAndPull();

  console.log("  > git add -A");
  git(["add", "-A"]);
  console.log(`  > git commit -m \"${subject}\"`);
  git(["commit", "-m", subject]);
  console.log("  > git push");
  git(["push"]);
  console.log(`\n  Done - ${subject}\n`);
}

function checkAndPull() {
  const upstream = gitQuiet(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]);
  if (!upstream) {
    console.log("\n  No upstream branch found. Skipping pull.\n");
    return;
  }

  console.log("\n  > git fetch");
  git(["-c", "maintenance.auto=false", "-c", "gc.auto=0", "fetch", "--quiet"]);
  const behind = Number(gitQuiet(["rev-list", "--count", `HEAD..${upstream}`]) || 0);
  if (!behind) {
    console.log("  Already up to date.\n");
    return;
  }

  console.log(`  Branch is behind ${upstream} by ${behind} commit(s).`);
  console.log("  > git pull --rebase --autostash");
  git(["-c", "maintenance.auto=false", "-c", "gc.auto=0", "pull", "--rebase", "--autostash"]);
  console.log("");
}

function renderReviewBox({ fileCount, subject, version }) {
  const rows = [
    "GitHub Commit Review",
    `Version: ${version}`,
    `Subject: ${subject}`,
    `Files: ${fileCount}`
  ];
  const width = Math.max(...rows.map((row) => row.length)) + 4;
  const border = `+${"-".repeat(width)}+`;
  const lines = rows.map((row) => `| ${row.padEnd(width - 2)} |`);
  return ["", border, ...lines, border, ""].join("\n");
}

function releaseSubject(version, title) {
  return `#${String(reference(version)).padStart(2, "0")} - ${title}`;
}

function rootVersion() {
  const version = String(readJson(join(root, "package.json")).version ?? "");
  if (!/^\d+\.\d+\.\d+$/u.test(version)) throw new Error(`Invalid package version: ${version}`);
  return version;
}

function nextPatch(version) {
  const [major, minor, patch] = version.split(".").map(Number);
  return `${major}.${minor}.${patch + 1}`;
}

function reference(version) {
  return Number(version.split(".")[2]);
}

function updatePackage(file, currentVersion, nextVersion) {
  const pkg = readJson(file);
  pkg.version = nextVersion;
  for (const field of [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies"
  ]) {
    for (const [name, value] of Object.entries(pkg[field] ?? {})) {
      if (
        (name.startsWith("@techmedia/") || name.startsWith("@codexsun/")) &&
        (value === currentVersion || value === `^${currentVersion}`)
      ) {
        pkg[field][name] = value.startsWith("^") ? `^${nextVersion}` : nextVersion;
      }
    }
  }
  writeJson(file, pkg);
}

function updateLockfile(currentVersion, nextVersion) {
  const file = join(root, "package-lock.json");
  if (!existsSync(file)) return;
  const lock = readJson(file);
  if (lock.version === currentVersion) lock.version = nextVersion;

  const workspacePaths = new Set(
    packageFiles().map((file) => relative(root, dirname(file)).replaceAll("\\", "/"))
  );
  for (const [lockPath, pkg] of Object.entries(lock.packages ?? {})) {
    if (
      pkg &&
      typeof pkg === "object" &&
      pkg.version === currentVersion &&
      (lockPath === "" || workspacePaths.has(lockPath))
    ) {
      pkg.version = nextVersion;
    }
  }
  writeJson(file, lock);
}

function updateDeploymentReleaseContract(nextVersion) {
  for (const client of ["techmedia", "rainbow"]) {
    const file = join(root, ".container", client, ".env.example");
    if (!existsSync(file)) throw new Error(`Deployment sample is missing for ${client}.`);
    const source = readFileSync(file, "utf8");
    const pattern = /^CLIENT_IMAGE_TAG=.*$/mu;
    if (!pattern.test(source)) throw new Error(`Deployment sample is missing CLIENT_IMAGE_TAG for ${client}.`);
    writeFileSync(file, source.replace(pattern, `CLIENT_IMAGE_TAG=${nextVersion}`), "utf8");
  }
}

function updateFlutterVersion(nextVersion) {
  const file = join(root, "apps", "techmedia_flutter", "pubspec.yaml");
  if (!existsSync(file)) return;
  const source = readFileSync(file, "utf8");
  const updated = source.replace(
    /^version:\s*\d+\.\d+\.\d+\+\d+\s*$/mu,
    `version: ${nextVersion}+${releaseBuild(nextVersion)}`
  );
  if (updated === source) throw new Error("Flutter pubspec version is missing.");
  writeFileSync(file, updated, "utf8");
}

function readFlutterVersion() {
  const file = join(root, "apps", "techmedia_flutter", "pubspec.yaml");
  const match = /^version:\s*(\d+\.\d+\.\d+)\+(\d+)\s*$/mu.exec(readFileSync(file, "utf8"));
  if (!match?.[1] || !match[2]) throw new Error("Flutter pubspec version is invalid.");
  return { build: Number(match[2]), version: match[1] };
}

function releaseBuild(version) {
  return Number(version.split(".")[2]);
}

function updateChangelog(nextVersion, title, databaseUpdate) {
  let changelog = readFileSync(changelogPath, "utf8")
    .replace(/Current version: .*/u, `Current version: ${nextVersion}`)
    .replace(/Release tag: .*/u, `Release tag: v-${nextVersion}`)
    .replace(/Changelog label: .*/u, `Changelog label: v ${nextVersion}`);

  const entry = [
    `## v-${nextVersion}`,
    "",
    `### [v ${nextVersion}] ${timestamp()} - ${title}`,
    "",
    "#### Database Changes",
    "",
    `- Database update: ${databaseUpdate ? "Yes" : "No"}.`,
    "",
    "#### App Codebase Changes",
    "",
    `- Bumped repository version to ${nextVersion}.`,
    ""
  ].join("\n");
  const index = changelog.indexOf("## v-");
  const insertAt = index < 0 ? changelog.length : index;
  changelog = `${changelog.slice(0, insertAt)}${entry}\n${changelog.slice(insertAt)}`;
  writeFileSync(changelogPath, changelog, "utf8");
}

function databaseUpdateMode() {
  if (args.includes("--database-update")) return true;
  if (args.includes("--no-database-update")) return false;
  const changed = gitQuiet(["diff", "--name-only", "HEAD", "--"]);
  return changed
    .split(/\r?\n/u)
    .filter(Boolean)
    .some((file) =>
      /(?:migration|database|schema|seed)/u.test(file.replaceAll("\\", "/").toLowerCase())
    );
}

function latestEntry(version) {
  const changelog = readFileSync(changelogPath, "utf8");
  const escaped = version.replaceAll(".", "\\.");
  const match = changelog.match(
    new RegExp(
      `^### \\[v\\s+${escaped}\\](?:\\s+\\d{4}-\\d{2}-\\d{2}(?:\\s+(?:[1-9]|1[0-2]):[0-5]\\d\\s+(?:am|pm))?)?\\s+-\\s+(.+)$`,
      "mu"
    )
  );
  if (!match?.[1]) throw new Error(`No changelog entry found for v ${version}.`);
  return { title: match[1].trim() };
}

function timestamp() {
  const date = new Date();
  const datePart = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
  const timePart = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  })
    .format(date)
    .toLowerCase();
  return `${datePart} ${timePart}`;
}

function option(name) {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function git(gitArgs, silent = false) {
  return (
    execFileSync("git", gitArgs, {
      cwd: root,
      encoding: "utf8",
      stdio: silent ? ["ignore", "pipe", "inherit"] : "inherit"
    })?.trim() ?? ""
  );
}

function gitQuiet(gitArgs) {
  try {
    return git(gitArgs, true);
  } catch {
    return "";
  }
}

async function withPrompt(callback) {
  if (!process.stdin.isTTY && platform() === "win32") {
    return callback(askWindowsModal);
  }
  if (!process.stdin.isTTY) {
    throw new Error("Interactive terminal required; pass --yes only after reviewing --dry-run.");
  }
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await callback(
      (question, defaultValue = "") =>
        new Promise((resolveAnswer) => {
          readline.question(question, (answer) => resolveAnswer(answer || defaultValue));
        })
    );
  } finally {
    readline.close();
  }
}

function isYes(value) {
  return ["y", "yes"].includes(value.trim().toLowerCase());
}

function askWindowsModal(question, defaultValue = "") {
  const confirmation = /\[y\/N\]:\s*$/iu.test(question);
  const script = confirmation
    ? [
        "Add-Type -AssemblyName System.Windows.Forms",
        `$result = [System.Windows.Forms.MessageBox]::Show(${quotePowerShellString(
          question.replace(/\s*\[y\/N\]:\s*$/iu, "")
        )}, 'GitHub Commit Review', 'YesNo', 'Question')`,
        "if ($result -eq 'Yes') { 'yes' } else { 'no' }"
      ].join("; ")
    : [
        "Add-Type -AssemblyName Microsoft.VisualBasic",
        `[Microsoft.VisualBasic.Interaction]::InputBox(${quotePowerShellString(
          question
        )}, 'GitHub Commit Review', ${quotePowerShellString(defaultValue)})`
      ].join("; ");
  return execFileSync("powershell.exe", ["-NoProfile", "-STA", "-Command", script], {
    encoding: "utf8",
    windowsHide: false
  }).trim();
}

function quotePowerShellString(value) {
  return `'${value.replaceAll("'", "''")}'`;
}
