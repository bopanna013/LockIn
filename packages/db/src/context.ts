import { sql } from "drizzle-orm";
import type { Database } from "./client";

export interface RequestContext {
  userId: string;
  orgId: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Run database work on behalf of a signed-in user.
 *
 * Sets transaction-local settings that Row-Level Security policies read through
 * `system.current_user_id()` / `system.current_org_id()`. Because the settings are
 * transaction-scoped (`set_config(..., true)`), they can never leak to another request
 * that later reuses the same pooled connection.
 */
export async function withRequestContext<T>(
  db: Database,
  context: RequestContext,
  work: (tx: Parameters<Parameters<Database["transaction"]>[0]>[0]) => Promise<T>,
): Promise<T> {
  if (!UUID_PATTERN.test(context.userId) || !UUID_PATTERN.test(context.orgId)) {
    throw new Error("withRequestContext requires UUID userId and orgId");
  }
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.user_id', ${context.userId}, true), set_config('app.org_id', ${context.orgId}, true)`,
    );
    return work(tx);
  });
}
