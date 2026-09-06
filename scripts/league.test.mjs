import test from "node:test";
import assert from "node:assert/strict";
import { standings, validateResult } from "../src/lib/league.ts";
import { issueSession, verifySession } from "../src/lib/session.ts";
const players = ["Ezzy", "Tamim", "Anas", "Akif"].map((name, i) => ({
  id: String(i),
  name,
}));
const season = {
  road_bonus: 10,
  army_bonus: 10,
  id: "s3",
  name: "Catan 3.0",
  total_games: 18,
  prize_pool: 10000,
  status: "completed",
  created_at: "2026-05-02",
};
const game = {
  id: "g",
  game_number: 1,
  date: "2026-05-02",
  winner_id: "0",
  tournament_id: "s3",
  game_scores: players.map((p, i) => ({
    player_id: p.id,
    points: 10 - i,
    longest_road: i === 0,
    largest_army: i === 0,
  })),
};
test("season 3 achievement bonuses do not change base points", () => {
  const rows = standings(players, [game], season);
  assert.equal(rows[0].points, 10);
  assert.equal(rows[0].bonus, 20);
  assert.equal(rows[0].total, 30);
});
test("seasons 1 and 2 do not inherit season 3 bonuses", () => {
  assert.equal(
    standings(players, [game], {
      ...season,
      name: "Catan 2.0",
      road_bonus: 0,
      army_bonus: 0,
    })[0].bonus,
    0,
  );
});
test("nullified results do not affect points or streaks", () => {
  const rows = standings(
    players,
    [{ ...game, voided_at: "2026-05-03" }],
    season,
  );
  assert.equal(rows[0].played, 0);
  assert.equal(rows[0].total, 0);
  assert.equal(rows[0].bestStreak, 0);
});
test("ties remain shared and unresolved bonus rules are explicit", () => {
  const games = [
    game,
    {
      ...game,
      id: "g2",
      game_number: 2,
      winner_id: "1",
      game_scores: players.map((p, i) => ({
        player_id: p.id,
        points: 9 + (i === 1 ? 1 : 0),
        longest_road: i === 1,
        largest_army: i === 1,
      })),
    },
  ];
  const pending = standings(players, games, season);
  assert.ok(pending[0].unresolvedBonus);
  const split = standings(players, games, {
    ...season,
    bonus_tie_rule: "split",
  });
  assert.equal(split.find((p) => p.id === "0").bonus, 10);
  assert.equal(split.find((p) => p.id === "1").bonus, 10);
});
test("invalid or incomplete scores cannot become game records", () => {
  const result = {
    gameNumber: 1,
    date: "2026-05-02",
    scores: game.game_scores,
  };
  assert.equal(validateResult(result).scores.length, 4);
  assert.throws(() =>
    validateResult({ ...result, scores: [...result.scores.slice(1)] }),
  );
  assert.throws(() =>
    validateResult({
      ...result,
      scores: result.scores.map((s) => ({ ...s, points: 10 })),
    }),
  );
  assert.throws(() => validateResult({ ...result, date: "2026-02-30" }));
  assert.throws(() =>
    validateResult({
      ...result,
      scores: result.scores.map((s) => ({ ...s, points: -1 })),
    }),
  );
});
test("signed sessions reject tampering and missing signatures", async () => {
  process.env.SESSION_SECRET = "test-only-secret";
  const token = await issueSession("viewer");
  assert.equal(await verifySession(token), "viewer");
  assert.equal(await verifySession(token.replace("viewer", "admin")), null);
  assert.equal(await verifySession(""), null);
  assert.equal(await verifySession("0.admin.bad"), null);
});
