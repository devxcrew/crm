import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const apiModules = resolve(root, "src/platform/api/src/modules");
const webModules = resolve(root, "src/platform/web/src/modules");
const sharedModules = new Set([
  "branding",
  "crm",
  "estimate",
  "frappe",
  "hr",
  "honey",
  "ishop",
  "messaging",
  "notification",
  "permission",
  "quotation",
  "role",
  "role-permission",
  "user",
  "user-role"
]);
const webOnlyModules = new Set(["docs"]);
const allowedApiModules = sharedModules;
const allowedWebModules = new Set([...sharedModules, ...webOnlyModules]);
const failures = [];

for (const [moduleRoot, allowedModules] of [
  [apiModules, allowedApiModules],
  [webModules, allowedWebModules]
]) {
  for (const entry of readdirSync(moduleRoot, { withFileTypes: true })) {
    if (entry.isDirectory() && !allowedModules.has(entry.name)) {
      failures.push(`unexpected module directory: ${relative(root, join(moduleRoot, entry.name))}`);
    }
  }
}

for (const name of sharedModules) {
  if (!existsSync(join(apiModules, name, "index.ts")))
    failures.push(`API ${name}: missing index.ts`);
  if (!existsSync(join(webModules, name, "index.ts")))
    failures.push(`Web ${name}: missing index.ts`);
}

for (const file of sourceFiles(resolve(root, "src/platform"))) {
  const source = readFileSync(file, "utf8");
  if (/@codexsun\/core|modules\/(?:app-registry|subscription|plan|entitlement)/u.test(source)) {
    failures.push(`${relative(root, file)}: imports a removed product/platform boundary`);
  }
}

for (const moduleName of ["crm", "estimate", "quotation", "ishop", "hr"]) {
  for (const suffix of ["migration.ts", "repository.ts", "seed.ts"]) {
    const forbidden = `${moduleName}.${suffix}`;
    if (existsSync(join(apiModules, moduleName, forbidden))) {
      failures.push(`${moduleName} must remain live-Frappe only: ${forbidden}`);
    }
  }
}

if (failures.length) {
  console.error(`Module boundary check failed:\n${failures.map((item) => `- ${item}`).join("\n")}`);
  process.exit(1);
}
console.info(
  "Module boundary check passed: owned web Docs, Identity, Honey AI, internal notifications, and live-Frappe business modules only."
);

function sourceFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(path));
    else if ([".ts", ".tsx"].includes(extname(entry.name))) files.push(path);
  }
  return files;
}
