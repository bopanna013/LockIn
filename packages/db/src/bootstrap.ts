/**
 * One-time (idempotent) database bootstrap. Run with a SUPERUSER connection:
 *
 *   pnpm --filter @lockin/db bootstrap
 *
 * Creates the three least-privilege login roles and hands database ownership to
 * lockin_owner. Schema-level grants live in migrations so they stay versioned.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config({ path: resolve(fileURLToPath(new URL("../../..", import.meta.url)), ".env") });
dotenv.config();
import postgres from "postgres";
import { bootstrapDbEnvSchema, parseEnv } from "./env";

export const ROLES = {
  owner: "lockin_owner",
  app: "lockin_app",
  cms: "lockin_cms",
} as const;

/** Escape a value for use as a SQL string literal (role passwords cannot be bound parameters). */
function literal(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export interface BootstrapOptions {
  adminUrl: string;
  dbName: string;
  passwords: { owner: string; app: string; cms: string };
}

export async function bootstrapDatabase(options: BootstrapOptions): Promise<void> {
  const sql = postgres(options.adminUrl, { max: 1, onnotice: () => {} });
  try {
    for (const [key, role] of Object.entries(ROLES) as [keyof typeof ROLES, string][]) {
      const password = options.passwords[key];
      await sql.unsafe(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN
            CREATE ROLE ${role} LOGIN;
          END IF;
        END
        $$;
      `);
      await sql.unsafe(
        `ALTER ROLE ${role} WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD ${literal(password)}`,
      );
    }

    const db = options.dbName;
    await sql.unsafe(`ALTER DATABASE ${db} OWNER TO ${ROLES.owner}`);
    await sql.unsafe(`REVOKE ALL ON DATABASE ${db} FROM PUBLIC`);
    await sql.unsafe(`GRANT CONNECT, TEMPORARY ON DATABASE ${db} TO ${ROLES.app}, ${ROLES.cms}`);
  } finally {
    await sql.end();
  }

  // The `public` schema must not be a dumping ground any role can write to.
  const dbSql = postgres(replaceDatabase(options.adminUrl, options.dbName), {
    max: 1,
    onnotice: () => {},
  });
  try {
    await dbSql.unsafe(`REVOKE ALL ON SCHEMA public FROM PUBLIC`);
    await dbSql.unsafe(`ALTER SCHEMA public OWNER TO ${ROLES.owner}`);
  } finally {
    await dbSql.end();
  }
}

function replaceDatabase(url: string, dbName: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${dbName}`;
  return parsed.toString();
}

if (process.argv[1]?.endsWith("bootstrap.ts")) {
  const env = parseEnv(bootstrapDbEnvSchema);
  bootstrapDatabase({
    adminUrl: env.DATABASE_ADMIN_URL,
    dbName: env.DB_NAME,
    passwords: { owner: env.DB_OWNER_PASSWORD, app: env.DB_APP_PASSWORD, cms: env.DB_CMS_PASSWORD },
  })
    .then(() => console.log("✔ Database roles bootstrapped"))
    .catch((error: unknown) => {
      console.error("✖ Bootstrap failed:", error);
      process.exit(1);
    });
}
