export type SeasonSetup = {
  requestId: string;
  name: string;
  totalGames: number;
  prizePool: number;
  bonusTieRule: "each" | "split" | "none";
  roadBonus: number;
  armyBonus: number;
  houseRules: string[];
};
export function validateSeasonSetup(value: unknown): SeasonSetup {
  if (!value || typeof value !== "object")
    throw new Error("Check the season details.");
  const v = value as Record<string, unknown>;
  if (
    typeof v.requestId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v.requestId,
    )
  )
    throw new Error("Reopen the season setup and try again.");
  if (typeof v.name !== "string" || !v.name.trim() || v.name.trim().length > 60)
    throw new Error("Enter a season name (up to 60 characters).");
  for (const [key, min, max] of [
    ["totalGames", 1, 100],
    ["prizePool", 0, 1000000],
    ["roadBonus", 0, 100],
    ["armyBonus", 0, 100],
  ] as const) {
    if (
      !Number.isInteger(v[key]) ||
      Number(v[key]) < min ||
      Number(v[key]) > max
    )
      throw new Error(
        `Check ${key === "totalGames" ? "the game count" : key === "prizePool" ? "the prize pool" : "the bonus points"}.`,
      );
  }
  if (!["each", "split", "none"].includes(String(v.bonusTieRule)))
    throw new Error("Choose what happens when bonus leaders tie.");
  if (
    !Array.isArray(v.houseRules) ||
    v.houseRules.length > 10 ||
    v.houseRules.some(
      (r) => typeof r !== "string" || !r.trim() || r.trim().length > 300,
    )
  )
    throw new Error("Add up to 10 house rules, each under 300 characters.");
  return {
    ...v,
    name: v.name.trim(),
    houseRules: v.houseRules.map((r) => (r as string).trim()),
  } as SeasonSetup;
}
