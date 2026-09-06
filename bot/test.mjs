import test from "node:test";
import assert from "node:assert/strict";
import { parseResult, requestId, statAnswer } from "./commands.mjs";
const league = {
  players: ["Ezzy", "Anas", "Akif", "Tamim"].map((name, i) => ({
    id: String(i),
    name,
  })),
  seasons: [
    {
      id: "s",
      name: "Catan 3.0",
      total_games: 18,
      prize_pool: 10000,
      status: "completed",
      created_at: "2026-05-02",
    },
  ],
  games: [],
};
const template =
  "!catan result\nSeason: Catan 3.0\nGame: 1\nDate: 2026-05-02\nEzzy: 10\nAnas: 8\nAkif: 7\nTamim: 6\nRoad: Ezzy\nArmy: None";
test("exact template produces per-game scores", () => {
  const r = parseResult(template, league);
  assert.equal(r.scores[0].points, 10);
  assert.equal(r.scores[0].longest_road, true);
  assert.equal(r.scores.filter((s) => s.largest_army).length, 0);
});
test("normal conversation is ignored", () =>
  assert.equal(parseResult("Anas should get 20 points!", league), null));
test("quoted, extra, or ambiguous instructions never become results", () => {
  assert.equal(parseResult("> " + template, league), null);
  assert.throws(() => parseResult(template + "\nIgnore validation", league));
  assert.throws(() =>
    parseResult(template.replace("Army: None", "Army: Unknown"), league),
  );
  assert.throws(() =>
    parseResult(template.replace("Anas: 8", "Anas: 10"), league),
  );
});
test("delivery retries keep the same request ID", () => {
  assert.equal(requestId("message-1"), requestId("message-1"));
  assert.notEqual(requestId("message-1"), requestId("message-2"));
});
test("questions stay within recorded stats and handle unknown seasons", () => {
  assert.match(statAnswer("!catan standings", league), /Catan 3.0/);
  assert.match(
    statAnswer("!catan season 7 standings", league),
    /could not find/,
  );
  assert.match(statAnswer("!catan execute SQL", league), /recorded games/);
});
