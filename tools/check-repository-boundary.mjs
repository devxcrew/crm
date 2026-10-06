import { existsSync, readFileSync, realpathSync, readdirSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const internalPackages = new Map([
  ["@codexsun/framework", "packages/framework"],
  ["@codexsun/ui", "packages/ui"]
]);
const failures = [];

for (const [packageName, packagePath] of internalPackages) {
  const manifestPath = resolve(root, packagePath, "package.json");
  if (!existsSync(manifestPath)) {
    failures.push(`${packagePath}: internal package is missing`);
    continue;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.name !== packageName) {
    failures.push(`${packagePath}: expected package name ${packageName}`);
  }
}

for (const manifestPath of packageManifests(root)) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  for (const field of [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies"
  ]) {
    for (const [name, specifier] of Object.entries(manifest[field] ?? {})) {
      if (typeof specifier !== "string" || !specifier.startsWith("file:")) continue;
      const target = resolve(resolve(manifestPath, ".."), specifier.slice("file:".length));
      if (!insideRoot(target)) {
        failures.push(
          `${relative(root, manifestPath)}: ${field}.${name} resolves outside the repository`
        );
      }
    }
  }
}

const boundaryFiles = [
  ".container/techmedia/docker-compose.yml",
  ".container/techmedia/Dockerfile",
  ".container/rainbow/docker-compose.yml",
  ".container/rainbow/Dockerfile",
  "components.json",
  "package.json",
  "package-lock.json",
  "src/platform/api/package.json",
  "src/platform/web/package.json",
  "src/platform/web/tsconfig.json",
  "src/platform/web/vite.config.ts",
  "tools/preflight.mjs",
  "tools/install-stack.mjs",
  "tools/stack-command.mjs",
  "turbo.json"
];
const forbidden = [
  /file:\.\.\/(?:framework|ui)(?:\/|["'])/u,
  /\.\.\/\.\.\/\.\.\/\.\.\/(?:framework|ui)(?:\/|["'])/u,
  /COPY\s+(?:framework|ui|core)\s/u,
  /resolve\([^)]*,\s*"\.\.",\s*"(?:framework|ui)"\)/u
];

for (const file of boundaryFiles) {
  const path = resolve(root, file);
  if (!existsSync(path)) continue;
  const source = readFileSync(path, "utf8").replaceAll("\\", "/");
  for (const pattern of forbidden) {
    if (pattern.test(source))
      failures.push(`${file}: contains external workspace reference ${pattern}`);
  }
}

for (const [packageName, packagePath] of internalPackages) {
  const linkedPath = resolve(root, "node_modules", ...packageName.split("/"));
  if (!existsSync(linkedPath)) continue;
  const actual = realpathSync(linkedPath);
  const expected = realpathSync(resolve(root, packagePath));
  if (actual !== expected) {
    failures.push(`${packageName}: node_modules link resolves to ${actual}, expected ${expected}`);
  }
}

if (failures.length > 0) {
  console.error(
    `Repository boundary check failed:\n${failures.map((item) => `- ${item}`).join("\n")}`
  );
  process.exit(1);
}

console.info(
  "Repository boundary verified: Framework and UI resolve from internal workspaces only."
);

function packageManifests(directory) {
  const manifests = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && [".git", ".turbo", "dist", "node_modules"].includes(entry.name)) {
      continue;
    }
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) manifests.push(...packageManifests(path));
    else if (entry.name === "package.json") manifests.push(path);
  }
  return manifests;
}

function insideRoot(path) {
  const value = relative(root, path);
  return value === "" || (!value.startsWith("..") && !isAbsolute(value));
}
