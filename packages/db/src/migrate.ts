/**
 * Apply pending migrations using the schema-owner role.
 *
 *   pnpm db:migrate
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config({ path: resolve(fileURLToPath(new URL("../../..", import.meta.url)), ".env") });
dotenv.config();
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { migrationDbEnvSchema, parseEnv } from "./env";

export const MIGRATIONS_FOLDER = fileURLToPath(new URL("../migrations", import.meta.url));

export async function runMigrations(migrationUrl: string): Promise<void> {
  const client = postgres(migrationUrl, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), {
      migrationsFolder: MIGRATIONS_FOLDER,
      // Kept outside the app schemas so migration 0000 can create `system` itself.
      migrationsSchema: "drizzle",
      migrationsTable: "schema_migrations",
    });
  } finally {
    await client.end();
  }
}

if (process.argv[1]?.endsWith("migrate.ts")) {
  const env = parseEnv(migrationDbEnvSchema);
  runMigrations(env.DATABASE_MIGRATION_URL)
    .then(() => console.log("✔ Migrations applied"))
    .catch((error: unknown) => {
      console.error("✖ Migration failed:", error);
      process.exit(1);
    });
}
