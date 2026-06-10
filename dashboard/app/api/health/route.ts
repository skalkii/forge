import { NextResponse } from "next/server";
import { z } from "zod";
import { queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

const HealthRow = z.object({
  now: z.coerce.date(),
  version: z.string(),
});

export async function GET() {
  try {
    const row = await queryOne(
      HealthRow,
      "select now() as now, current_setting('server_version') as version",
    );
    return NextResponse.json({ ok: true, db: row });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 503 },
    );
  }
}
