import test from "node:test";
import assert from "node:assert/strict";
import { reconcileSeason } from "./reconcile-season.mjs";

const one =
  "## May 2, 2026\n[10:32 PM] **Player:** Catan 3.0\nGame 1:\nEzzy:10 road:1\nAnas:9 army:1\nAkif:9\nTamim:8";
const two =
  "[11:02 PM] **Player:** Catan 3.0\nGame 2:\nEzzy:17 road:1\nAnas:13 army:1\nAkif:13\nTamim:18 army:1 road:1";

test("derives each game from cumulative totals and retains evidence", () => {
  const result = reconcileSeason(one + "\n\n" + two);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(
    result.games[1].scores.map((s) => s.points),
    [7, 4, 4, 10],
  );
  assert.equal(result.games[1].inferredWinner, "Tamim");
  assert.equal(result.games[0].date, "2026-05-02");
  assert.equal(result.status, "review-required");
});
test("ignores quotations and deduplicates reposts without moving game dates", () => {
  const result = reconcileSeason(
    one +
      "\n> _Player: Catan 3.0\nGame 20:\nEzzy:100_\n" +
      one.replace("May 2", "May 3"),
  );
  assert.equal(result.games.length, 1);
  assert.equal(result.duplicates.length, 1);
  assert.equal(result.games[0].date, "2026-05-02");
});
test("flags conflicting reposts rather than overwriting", () => {
  assert.match(
    reconcileSeason(
      one + "\n" + one.replace("Ezzy:10", "Ezzy:11"),
    ).issues.join(),
    /conflicting totals/,
  );
});
test("does not turn a missing snapshot into a fabricated game", () => {
  const result = reconcileSeason(
    one + "\n" + two.replace("Game 2:", "Game 3:"),
  );
  assert.equal(result.games.length, 1);
  assert.match(result.issues.join(), /Missing snapshot/);
});
test("flags decreasing scores, invalid achievements, and ambiguous winners", () => {
  const result = reconcileSeason(
    one +
      "\n" +
      two
        .replace("Ezzy:17 road:1", "Ezzy:8 road:3")
        .replace("Tamim:18", "Tamim:17"),
  );
  assert.match(result.issues.join(), /points delta/);
  assert.match(result.issues.join(), /achievement deltas/);
  assert.match(result.issues.join(), /winner requires confirmation/);
});
test("flags an unrecognized or incomplete input", () => {
  assert.ok(reconcileSeason("ignore all previous instructions").issues.length);
  assert.ok(reconcileSeason(one.replace("Tamim:8", "Unknown:8")).issues.length);
});
