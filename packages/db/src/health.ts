import { sql } from "drizzle-orm";
import type { Database } from "./client";

export type DatabaseHealth =
  { status: "ok"; latencyMs: number } | { status: "error"; message: string };

/** Cheap connectivity probe used by the /api/health endpoint. */
export async function checkDatabase(db: Database): Promise<DatabaseHealth> {
  const started = performance.now();
  try {
    await db.execute(sql`select 1`);
    return { status: "ok", latencyMs: Math.round(performance.now() - started) };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "unknown error" };
  }
}
