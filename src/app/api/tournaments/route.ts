import { NextRequest, NextResponse } from "next/server";
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
    const { name, totalGames, prizePool, bonusTieRule, roadBonus, armyBonus } =
      await req.json();
    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.length > 60 ||
      !Number.isInteger(totalGames) ||
      totalGames < 1 ||
      totalGames > 100 ||
      !Number.isInteger(prizePool) ||
      prizePool < 0 ||
      prizePool > 1000000 ||
      !["each", "split", "none"].includes(bonusTieRule) ||
      ![0, 10].includes(roadBonus) ||
      ![0, 10].includes(armyBonus)
    )
      throw new Error("Check the season name, rules, prize, and game count.");
    const { data, error } = await database().rpc("create_chambers_season", {
      p_name: name.trim(),
      p_total_games: totalGames,
      p_prize_pool: prizePool,
      p_tie: bonusTieRule,
      p_road: roadBonus,
      p_army: armyBonus,
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
