import { z } from "zod";

/**
 * Database connection settings. Each URL uses a different Postgres role:
 *
 * - DATABASE_URL            → lockin_app   (runtime: read content, read/write student + system)
 * - DATABASE_CMS_URL        → lockin_cms   (CMS writes: read/write content, no student access)
 * - DATABASE_MIGRATION_URL  → lockin_owner (owns schemas, runs migrations)
 * - DATABASE_ADMIN_URL      → superuser    (one-time bootstrap of roles only)
 */
const postgresUrl = z
  .string()
  .url()
  .refine((value) => value.startsWith("postgres://") || value.startsWith("postgresql://"), {
    message: "Must be a postgres:// or postgresql:// URL",
  });

export const runtimeDbEnvSchema = z.object({
  DATABASE_URL: postgresUrl,
  DATABASE_CMS_URL: postgresUrl.optional(),
});

export const migrationDbEnvSchema = z.object({
  DATABASE_MIGRATION_URL: postgresUrl,
});

export const bootstrapDbEnvSchema = z.object({
  DATABASE_ADMIN_URL: postgresUrl,
  DB_NAME: z
    .string()
    .regex(/^[a-z_][a-z0-9_]*$/)
    .default("lockin"),
  DB_OWNER_PASSWORD: z.string().min(16, "Use at least 16 characters"),
  DB_APP_PASSWORD: z.string().min(16, "Use at least 16 characters"),
  DB_CMS_PASSWORD: z.string().min(16, "Use at least 16 characters"),
});

export function parseEnv<T extends z.ZodType>(
  schema: T,
  source: NodeJS.ProcessEnv = process.env,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid database environment configuration:\n${details}`);
  }
  return result.data;
}
