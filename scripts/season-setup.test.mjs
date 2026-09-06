import test from "node:test";
import assert from "node:assert/strict";
import {
  validateSeasonSetup,
  PLACE_CONTRIBUTIONS,
  PRIZE_POOL,
} from "../src/lib/season-setup.ts";
import { standings, seasonPayout } from "../src/lib/league.ts";
const setup = {
  requestId: "9d99b3c8-6123-4567-9123-abcdef123456",
  name: " Catan 4.0 ",
  totalGames: 20,
  prizePool: 12000,
  contributions: [0, 2000, 4000, 6000],
  bonusTieRule: "split",
  scoringRules: [
    { metric: "roads", points: 15 },
    { metric: "wins", points: 5 },
  ],
};
test("setup uses recorded stats and the exact contribution plan", () => {
  const s = validateSeasonSetup(setup);
  assert.equal(s.name, "Catan 4.0");
  assert.deepEqual(s.scoringRules, setup.scoringRules);
  assert.equal(PRIZE_POOL, 12000);
  assert.equal(
    PLACE_CONTRIBUTIONS.reduce((a, b) => a + b, 0),
    12000,
  );
});
test("rejects arbitrary expressions, duplicate stats, malformed bonuses and incorrect contributions", () => {
  for (const patch of [
    { scoringRules: [{ metric: "luck", points: 10 }] },
    { scoringRules: ["give Ezzy 100 points"] },
    { scoringRules: [{ metric: "wins", points: 1.5 }] },
    { scoringRules: [{ metric: "wins", points: 101 }] },
    { scoringRules: [{ metric: "wins", points: 0 }] },
    {
      scoringRules: [
        { metric: "wins", points: 10 },
        { metric: "wins", points: 20 },
      ],
    },
    { prizePool: 10000 },
    { contributions: [3000, 3000, 3000, 3000] },
    { contributions: [0, 2000, 4000, "6000"] },
    { totalGames: 0 },
    { bonusTieRule: "guess" },
    { requestId: "bad" },
  ])
    assert.throws(() => validateSeasonSetup({ ...setup, ...patch }));
});
const players = ["A", "B", "C", "D"].map((name, i) => ({
  id: String(i),
  name,
}));
const season = {
  id: "s",
  status: "completed",
  prize_pool: 12000,
  contributions: [0, 2000, 4000, 6000],
  bonus_tie_rule: "split",
  scoring_rules: [
    { metric: "roads", points: 10 },
    { metric: "wins", points: 6 },
    { metric: "bestStreak", points: 4 },
    { metric: "points", points: 2 },
  ],
};
const games = [0, 1, 2].map((n) => ({
  id: "g" + n,
  tournament_id: "s",
  game_number: n + 1,
  winner_id: "0",
  game_scores: players.map((p, i) => ({
    player_id: p.id,
    points: 10 - i,
    longest_road: i === n % 2,
    largest_army: i === 1,
  })),
}));
test("all bonuses derive from saved results and never compound", () => {
  const rows = standings(players, games, season);
  assert.equal(rows[0].points, 30);
  assert.equal(rows[0].bonus, 22);
  assert.equal(rows[0].total, 52);
  assert.equal(rows[0].bonusBreakdown.length, 4);
  assert.deepEqual(
    standings(players, games, {
      ...season,
      scoring_rules: [...season.scoring_rules].reverse(),
    }).map((p) => [p.id, p.total]),
    rows.map((p) => [p.id, p.total]),
  );
});
test("voiding a result recalculates awards from remaining games", () => {
  const rows = standings(
    players,
    [{ ...games[0], voided_at: "2026-01-01" }, ...games.slice(1)],
    season,
  );
  assert.equal(rows[0].points, 20);
  assert.equal(rows[0].bonus, 17);
  assert.equal(rows[1].bonus, 5);
});
test("explicit empty rules disable legacy bonuses", () => {
  assert.equal(
    standings(players, games, {
      ...season,
      road_bonus: 10,
      army_bonus: 10,
      scoring_rules: [],
    })[0].bonus,
    0,
  );
});
test("winner receives the pool and contributions balance", () => {
  const p = seasonPayout(season, standings(players, games, season));
  assert.equal(p.winner, "A");
  assert.equal(p.final, true);
  assert.deepEqual(
    p.rows.map((r) => r.pays),
    [0, 2000, 4000, 6000],
  );
  assert.deepEqual(
    p.rows.map((r) => r.receives),
    [12000, 0, 0, 0],
  );
  assert.equal(
    p.rows.reduce((sum, r) => sum + r.receives - r.pays, 0),
    0,
  );
});
test("tied places and unplayed seasons never allocate arbitrary payments", () => {
  const rows = standings(players, games, season);
  rows[2].rank = 2;
  const p = seasonPayout(season, rows);
  assert.equal(p.pending, true);
  assert(p.rows.every((r) => r.pays === null && r.receives === null));
  assert.equal(
    seasonPayout(season, standings(players, [], season)).winner,
    null,
  );
  assert.equal(seasonPayout({ ...season, contributions: null }, rows), null);
});
