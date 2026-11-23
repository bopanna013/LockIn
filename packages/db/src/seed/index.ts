/**
 * Seed reference data. Uses the migration (owner) role because seeds write to `content`.
 *
 *   pnpm db:seed
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config({ path: resolve(fileURLToPath(new URL("../../../..", import.meta.url)), ".env") });
dotenv.config();
import { createDatabase } from "../client";
import { migrationDbEnvSchema, parseEnv } from "../env";
import { seedLocales } from "./locales";

const env = parseEnv(migrationDbEnvSchema);
const { db, client } = createDatabase(env.DATABASE_MIGRATION_URL, {
  max: 1,
  applicationName: "lockin-seed",
});

try {
  const count = await seedLocales(db);
  console.log(`✔ Seeded ${count} locales`);
} catch (error) {
  console.error("✖ Seed failed:", error);
  process.exitCode = 1;
} finally {
  await client.end();
}
