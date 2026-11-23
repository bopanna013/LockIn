import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

dotenv.config({ path: resolve(fileURLToPath(new URL("../..", import.meta.url)), ".env") });
dotenv.config();

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  casing: "snake_case",
  schemaFilter: ["content", "student", "system"],
  migrations: {
    schema: "drizzle",
    table: "schema_migrations",
  },
  dbCredentials: {
    url: process.env.DATABASE_MIGRATION_URL ?? "postgres://localhost:5432/lockin",
  },
  strict: true,
  verbose: true,
});
