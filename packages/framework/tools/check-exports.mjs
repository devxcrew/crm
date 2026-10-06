const publicExports = [
  "@codexsun/framework",
  "@codexsun/framework/api",
  "@codexsun/framework/config",
  "@codexsun/framework/db",
  "@codexsun/framework/env",
  "@codexsun/framework/errors",
  "@codexsun/framework/events",
  "@codexsun/framework/health",
  "@codexsun/framework/http",
  "@codexsun/framework/logger",
  "@codexsun/framework/modules",
  "@codexsun/framework/queue",
  "@codexsun/framework/storage"
];

for (const publicExport of publicExports) {
  await import(publicExport);
}

console.info(`Framework export check passed for ${publicExports.length} public entry points.`);
