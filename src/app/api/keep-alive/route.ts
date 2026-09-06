import { NextRequest, NextResponse } from "next/server";
import { database } from "@/lib/server";
import { same } from "@/lib/session";
export async function GET(req: NextRequest) {
  if (
    !process.env.CRON_SECRET ||
    !same(
      req.headers.get("authorization") || "",
      `Bearer ${process.env.CRON_SECRET}`,
    )
  )
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { error } = await database().from("players").select("id").limit(1);
  return NextResponse.json({ ok: !error }, { status: error ? 503 : 200 });
}
