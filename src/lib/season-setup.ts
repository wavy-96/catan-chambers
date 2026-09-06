export const RULE_METRICS = {
  roads: "Most Roads",
  armies: "Most Armies",
  wins: "Most wins",
  points: "Most game points",
  bestStreak: "Longest win streak",
} as const;
export type ScoringRule = { metric: keyof typeof RULE_METRICS; points: number };
export const PLACE_CONTRIBUTIONS = [0, 2000, 4000, 6000] as const;
export const PRIZE_POOL = PLACE_CONTRIBUTIONS.reduce<number>(
  (sum, amount) => sum + amount,
  0,
);
export type SeasonSetup = {
  requestId: string;
  name: string;
  totalGames: number;
  prizePool: number;
  contributions: number[];
  bonusTieRule: "each" | "split" | "none";
  scoringRules: ScoringRule[];
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
  if (
    !Number.isInteger(v.totalGames) ||
    Number(v.totalGames) < 1 ||
    Number(v.totalGames) > 100
  )
    throw new Error("Choose between 1 and 100 games.");
  if (
    v.prizePool !== PRIZE_POOL ||
    !Array.isArray(v.contributions) ||
    v.contributions.length !== 4 ||
    PLACE_CONTRIBUTIONS.some((n, i) => (v.contributions as unknown[])[i] !== n)
  )
    throw new Error(
      "The pool must be ₹12,000: ₹0, ₹2,000, ₹4,000, and ₹6,000 by place.",
    );
  if (!["each", "split", "none"].includes(String(v.bonusTieRule)))
    throw new Error("Choose what happens when bonus leaders tie.");
  if (
    !Array.isArray(v.scoringRules) ||
    v.scoringRules.length > Object.keys(RULE_METRICS).length
  )
    throw new Error("Choose rules based on recorded stats.");
  const seen = new Set<string>();
  const rules: ScoringRule[] = v.scoringRules.map((rule: unknown) => {
    if (!rule || typeof rule !== "object")
      throw new Error("Choose a recorded stat for each rule.");
    const r = rule as Record<string, unknown>;
    if (
      typeof r.metric !== "string" ||
      !Object.prototype.hasOwnProperty.call(RULE_METRICS, r.metric) ||
      seen.has(r.metric)
    )
      throw new Error("Choose each recorded stat only once.");
    if (
      !Number.isInteger(r.points) ||
      Number(r.points) < 1 ||
      Number(r.points) > 100
    )
      throw new Error("Bonus points must be whole numbers from 1 to 100.");
    seen.add(r.metric);
    return {
      metric: r.metric as ScoringRule["metric"],
      points: Number(r.points),
    };
  });
  return {
    requestId: v.requestId,
    name: v.name.trim(),
    totalGames: Number(v.totalGames),
    prizePool: PRIZE_POOL,
    contributions: [...PLACE_CONTRIBUTIONS],
    bonusTieRule: v.bonusTieRule as SeasonSetup["bonusTieRule"],
    scoringRules: rules,
  };
}
