import { checkDatabase, getDatabase } from "@lockin/db";
import { NextResponse } from "next/server";
import { serverEnv } from "@/env";

export const dynamic = "force-dynamic";

/**
 * Liveness/readiness probe for Docker healthchecks and Uptime Kuma.
 * Deliberately reveals no versions, hostnames or error details.
 */
export async function GET() {
  const { DATABASE_URL } = serverEnv();

  if (!DATABASE_URL) {
    return NextResponse.json({ status: "degraded", database: "not_configured" }, { status: 503 });
  }

  const database = await checkDatabase(
    getDatabase(DATABASE_URL, { applicationName: "lockin-web" }),
  );
  const healthy = database.status === "ok";

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      database: database.status,
      ...(healthy ? { latencyMs: database.latencyMs } : {}),
    },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
