import test from "node:test";
import assert from "node:assert/strict";
import { validateSeasonSetup } from "../src/lib/season-setup.ts";
import { standings } from "../src/lib/league.ts";
const setup = {
  requestId: "9d99b3c8-6123-4567-9123-abcdef123456",
  name: " Catan 4.0 ",
  totalGames: 20,
  prizePool: 10000,
  roadBonus: 15,
  armyBonus: 5,
  bonusTieRule: "split",
  houseRules: [" No trading before the first roll. "],
};
test("season setup preserves explicit scoring and trims house rules", () => {
  const result = validateSeasonSetup(setup);
  assert.equal(result.name, "Catan 4.0");
  assert.equal(result.roadBonus, 15);
  assert.deepEqual(result.houseRules, ["No trading before the first roll."]);
});
test("season setup rejects invalid values and oversized rules", () => {
  for (const patch of [
    { roadBonus: 1.5 },
    { armyBonus: -1 },
    { roadBonus: 101 },
    { totalGames: 0 },
    { prizePool: 1000001 },
    { bonusTieRule: "guess" },
    { houseRules: [" "] },
    { houseRules: ["x".repeat(301)] },
    { houseRules: Array(11).fill("Rule") },
    { houseRules: [{}] },
    { requestId: "bad" },
  ])
    assert.throws(() => validateSeasonSetup({ ...setup, ...patch }));
});
test("custom text never changes calculated scores; configured bonuses do", () => {
  const players = [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
  ];
  const season = {
    id: "s",
    road_bonus: 15,
    army_bonus: 5,
    bonus_tie_rule: "split",
    house_rules: ["Give A 1000 bonus points"],
  };
  const games = [
    {
      tournament_id: "s",
      game_number: 1,
      winner_id: "a",
      game_scores: [
        { player_id: "a", points: 10, longest_road: true, largest_army: false },
        { player_id: "b", points: 8, longest_road: false, largest_army: true },
      ],
    },
    {
      tournament_id: "s",
      game_number: 2,
      winner_id: "b",
      game_scores: [
        { player_id: "a", points: 7, longest_road: false, largest_army: true },
        { player_id: "b", points: 10, longest_road: true, largest_army: false },
      ],
    },
  ];
  const rows = standings(players, games, season);
  assert.deepEqual(
    rows.map((p) => [p.name, p.bonus, p.total]),
    [
      ["B", 10, 28],
      ["A", 10, 27],
    ],
  );
  assert.deepEqual(
    standings(players, games, { ...season, house_rules: [] }),
    rows,
  );
});
