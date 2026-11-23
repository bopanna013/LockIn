import { exportStudentPersonalData } from "@lockin/db";
import { NextResponse } from "next/server";
import { appDb, getCurrentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Sign-in required" }, { status: 401 });
  }

  const bundle = await exportStudentPersonalData(appDb(), {
    userId: session.user.id,
    orgId: session.orgId,
  });

  return new NextResponse(JSON.stringify(bundle, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="lockin-personal-data-${session.user.id.slice(0, 8)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
