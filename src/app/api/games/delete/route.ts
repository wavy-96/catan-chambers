import { NextRequest, NextResponse } from "next/server";
import { currentRole, database } from "@/lib/server";
export async function POST(req: NextRequest) {
  if ((await currentRole()) !== "admin")
    return NextResponse.json(
      { error: "Only Tamim can nullify games." },
      { status: 403 },
    );
  if (req.headers.get("origin") !== req.nextUrl.origin)
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  try {
    const { gameId, reason } = await req.json();
    if (
      typeof reason !== "string" ||
      reason.trim().length < 3 ||
      reason.length > 500
    )
      throw new Error("Add a brief reason for nullifying this game.");
    const { error } = await database().rpc("nullify_chambers_game", {
      p_game_id: gameId,
      p_reason: reason.trim(),
    });
    if (error)
      throw new Error(
        error.code === "PGRST202"
          ? "Nullifying is awaiting the database upgrade."
          : error.message,
      );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not nullify game." },
      { status: 400 },
    );
  }
}
