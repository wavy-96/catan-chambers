import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
// Private reviewed data is supplied separately, never embedded in public source.
const plan = JSON.parse(
  readFileSync(process.argv[2] || "../work/history-confirmation.json", "utf8"),
);
const review = JSON.parse(readFileSync(plan.sourceReview, "utf8"));
assert.equal(review.games.length, plan.season.total_games);
assert.deepEqual(review.issues, []);
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
function id(text) {
  const h = createHash("sha256").update(text).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
async function check(result) {
  if (result.error) throw result.error;
  return result.data;
}
const players = await check(await db.from("players").select("id,name"));
assert.equal(players.length, 4);
const pid = Object.fromEntries(players.map((p) => [p.name, p.id]));
const seasons = await check(await db.from("tournaments").select("*"));
const previous = seasons.find((s) => s.name === plan.previousSeason.name);
assert.ok(previous);
const existing = await check(
  await db
    .from("games")
    .select("*,game_scores(*)")
    .eq("tournament_id", previous.id),
);
const before = existing.filter(
  (g) => g.game_number < plan.previousSeason.gameNumber && !g.voided_at,
);
assert.equal(before.length, plan.previousSeason.gameNumber - 1);
for (const [name, total] of Object.entries(plan.previousSeason.expectedBefore))
  assert.equal(
    before.reduce(
      (n, g) =>
        n + (g.game_scores.find((s) => s.player_id === pid[name])?.points || 0),
      0,
    ),
    total,
    `History changed for ${name}; manual review required.`,
  );
const finale = players.map((p) => ({
  player_id: p.id,
  points: plan.previousSeason.scores[p.name],
  longest_road: p.name === plan.previousSeason.road,
  largest_army: p.name === plan.previousSeason.army,
}));
await check(
  await db.rpc("record_chambers_game", {
    p_request_id: id("confirmed-season2-game20"),
    p_tournament_id: previous.id,
    p_game_number: plan.previousSeason.gameNumber,
    p_date: plan.previousSeason.date,
    p_scores: finale,
  }),
);
console.log("Previous season finale recorded or verified.");
let season = seasons.find((s) => s.name === plan.season.name);
if (!season)
  season = await check(
    await db
      .from("tournaments")
      .insert({
        id: id("confirmed-catan-season3"),
        ...plan.season,
        status: "active",
      })
      .select()
      .single(),
  );
assert.equal(season.total_games, plan.season.total_games);
assert.equal(season.road_bonus, plan.season.road_bonus);
assert.equal(season.army_bonus, plan.season.army_bonus);
for (const game of review.games) {
  const scores = game.scores.map((s) => ({
    player_id: pid[s.name],
    points: s.points,
    longest_road: Boolean(s.road),
    largest_army: Boolean(s.army),
  }));
  await check(
    await db.rpc("record_chambers_game", {
      p_request_id: id("confirmed-season3-game" + game.number),
      p_tournament_id: season.id,
      p_game_number: game.number,
      p_date: game.date,
      p_scores: scores,
    }),
  );
  console.log(`Game ${game.number} recorded or verified.`);
}
const stats = await check(
  await db
    .from("tournament_player_stats")
    .select("*")
    .eq("tournament_id", season.id),
);
for (const [name, totals] of Object.entries(review.finalTotals)) {
  const s = stats.find((s) => s.player_id === pid[name]);
  assert.equal(s.total_points, totals.points);
  assert.equal(s.longest_road_count, totals.road);
  assert.equal(s.largest_army_count, totals.army);
  assert.equal(s.total_games, plan.season.total_games);
}
const final = await check(
  await db.from("tournaments").select("status").eq("id", season.id).single(),
);
assert.equal(final.status, "completed");
console.log(
  "Verified all games, cumulative totals, achievements, and completed status.",
);
