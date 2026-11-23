import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

interface ClientOptions {
  /** Max pooled connections. Keep small: a LAN deployment serves modest traffic. */
  max?: number;
  /** Application name visible in pg_stat_activity — helps when debugging. */
  applicationName?: string;
}

export function createDatabase(url: string, options: ClientOptions = {}) {
  const client = postgres(url, {
    max: options.max ?? 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: true,
    connection: { application_name: options.applicationName ?? "lockin" },
  });
  const db: Database = drizzle(client, { schema, casing: "snake_case" });
  return { db, client };
}

/* Reuse pools across hot reloads in development instead of leaking connections. */
const globalCache = globalThis as unknown as {
  __lockinDb?: Map<string, ReturnType<typeof createDatabase>>;
};

export function getDatabase(url: string, options: ClientOptions = {}): Database {
  globalCache.__lockinDb ??= new Map();
  const cached = globalCache.__lockinDb.get(url);
  if (cached) return cached.db;
  const created = createDatabase(url, options);
  globalCache.__lockinDb.set(url, created);
  return created.db;
}
