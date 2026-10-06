import { createConnection } from "mysql2/promise";
import { env } from "../env.js";
import {
  closeTechMediaDatabase,
  createTechMediaDatabase,
  migrateTechMediaDatabase,
  resetTechMediaDatabase,
  seedTechMediaDatabase,
  techMediaDatabaseName
} from "./techmedia-database.js";

type DbCommand = "migrate" | "seed" | "drop" | "fresh" | "migrations:list";
const validCommands: DbCommand[] = ["migrate", "seed", "drop", "fresh", "migrations:list"];
const command = process.argv[2] as DbCommand | undefined;

async function main() {
  if (!command || !validCommands.includes(command)) {
    console.info("Usage: tsx src/database/db-cli.ts migrate|seed|drop|fresh|migrations:list");
    process.exitCode = 1;
    return;
  }

  try {
    if (command === "migrate") {
      await createTechMediaDatabase();
      await migrateTechMediaDatabase();
    } else if (command === "seed") {
      await createTechMediaDatabase();
      await migrateTechMediaDatabase();
      await seedTechMediaDatabase();
    } else if (command === "drop" || command === "fresh") {
      await resetTechMediaDatabase();
    } else {
      await listMigrations();
    }
    console.info(`[database] db:${command} completed for "${techMediaDatabaseName()}"`);
  } finally {
    await closeTechMediaDatabase();
  }
}

async function listMigrations() {
  const connection = await createConnection({
    database: techMediaDatabaseName(),
    host: env.DB_HOST,
    password: env.DB_PASSWORD,
    port: env.DB_PORT,
    user: env.DB_USER,
    timezone: "Z"
  });
  try {
    const [rows] = await connection.query(
      "SELECT name, applied_at FROM schema_migrations ORDER BY applied_at, id"
    );
    console.table(rows);
  } finally {
    await connection.end();
  }
}

await main();
