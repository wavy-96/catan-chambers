import { NextRequest, NextResponse } from "next/server";
import { currentRole, database } from "@/lib/server";
export async function POST(req: NextRequest) {
  if ((await currentRole()) !== "admin")
    return NextResponse.json(
      { error: "Only Tamim can end seasons." },
      { status: 403 },
    );
  if (req.headers.get("origin") !== req.nextUrl.origin)
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  try {
    const { seasonId, note } = await req.json();
    if (
      typeof seasonId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        seasonId,
      ) ||
      typeof note !== "string" ||
      note.length > 300
    )
      throw new Error(
        "Choose a season and keep the note under 300 characters.",
      );
    const { error } = await database().rpc("end_chambers_season", {
      p_season_id: seasonId,
      p_note: note.trim(),
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not end season.",
      },
      { status: 400 },
    );
  }
}
