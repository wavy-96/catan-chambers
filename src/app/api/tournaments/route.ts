import { NextRequest, NextResponse } from "next/server";
import { validateSeasonSetup } from "@/lib/season-setup";
import { currentRole, database } from "@/lib/server";
export async function GET() {
  if (!(await currentRole()))
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { data, error } = await database()
    .from("tournaments")
    .select("*")
    .order("created_at", { ascending: false });
  return error
    ? NextResponse.json({ error: "Could not load seasons." }, { status: 503 })
    : NextResponse.json({ tournaments: data });
}
export async function POST(req: NextRequest) {
  if ((await currentRole()) !== "admin")
    return NextResponse.json(
      { error: "Only Tamim can create seasons." },
      { status: 403 },
    );
  if (req.headers.get("origin") !== req.nextUrl.origin)
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  try {
    const setup = validateSeasonSetup(await req.json());
    const { data, error } = await database().rpc("create_chambers_season_v3", {
      p_request_id: setup.requestId,
      p_name: setup.name,
      p_total_games: setup.totalGames,
      p_prize_pool: setup.prizePool,
      p_tie: setup.bonusTieRule,
      p_scoring_rules: setup.scoringRules,
      p_contributions: setup.contributions,
    });
    if (error)
      throw new Error(
        error.code === "PGRST202"
          ? "Season creation is awaiting the database upgrade."
          : error.message,
      );
    return NextResponse.json({ seasonId: data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not create season." },
      { status: 400 },
    );
  }
}
