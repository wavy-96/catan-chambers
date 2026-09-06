import { NextRequest, NextResponse } from "next/server";
import { currentRole, database } from "@/lib/server";
import { validateResult } from "@/lib/league";
export async function POST(req: NextRequest) {
  if ((await currentRole(true)) !== "admin")
    return NextResponse.json(
      { error: "Only Tamim can record games." },
      { status: 403 },
    );
  if (
    !req.headers.get("authorization") &&
    req.headers.get("origin") !== req.nextUrl.origin
  )
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  try {
    const body = await req.json(),
      result = validateResult(body);
    if (
      typeof body.requestId !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(body.requestId)
    )
      throw new Error("A valid request ID is required.");
    const { data, error } = await database().rpc("record_chambers_game", {
      p_request_id: body.requestId,
      p_tournament_id: body.seasonId,
      p_game_number: result.gameNumber,
      p_date: result.date,
      p_scores: result.scores,
    });
    if (error)
      return NextResponse.json(
        {
          error:
            error.code === "PGRST202"
              ? "Game saving is awaiting the database upgrade."
              : error.message,
        },
        { status: 409 },
      );
    return NextResponse.json({ gameId: data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid result." },
      { status: 400 },
    );
  }
}
