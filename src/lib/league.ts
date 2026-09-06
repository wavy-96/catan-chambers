export type Profile = { id: string; name: string; avatar_url?: string | null };
export type Season = {
  id: string;
  name: string;
  total_games: number;
  prize_pool: number;
  status: string;
  created_at: string;
  road_bonus?: number;
  army_bonus?: number;
  bonus_tie_rule?: string;
  completion_note?: string | null;
  house_rules?: string[];
};
export type Score = {
  player_id: string;
  points: number;
  longest_road: boolean;
  largest_army: boolean;
};
export type Match = {
  id: string;
  game_number: number;
  date: string;
  winner_id: string;
  tournament_id: string;
  voided_at?: string | null;
  game_scores: Score[];
};
export type League = {
  players: Profile[];
  seasons: Season[];
  games: Match[];
  role: "viewer" | "admin";
};
export const COLORS: Record<string, string> = {
  Ezzy: "#a9680b",
  Tamim: "#7c58b5",
  Anas: "#268575",
  Akif: "#397bb5",
};

export function seasonRules(season: Season) {
  return {
    road: season.road_bonus ?? 0,
    army: season.army_bonus ?? 0,
    tie: season.bonus_tie_rule ?? "pending",
    note: season.completion_note ?? null,
  };
}

export function standings(
  players: Profile[],
  allGames: Match[],
  season: Season,
) {
  const games = allGames
    .filter((g) => g.tournament_id === season.id && !g.voided_at)
    .sort((a, b) => a.game_number - b.game_number);
  const rules = seasonRules(season);
  const rows = players.map((player) => {
    let points = 0,
      roads = 0,
      armies = 0,
      wins = 0,
      streak = 0,
      bestStreak = 0,
      played = 0;
    const form: number[] = [];
    for (const game of games) {
      const score = game.game_scores.find((s) => s.player_id === player.id);
      if (!score) continue;
      points += score.points;
      roads += Number(score.longest_road);
      armies += Number(score.largest_army);
      played++;
      const won = game.winner_id === player.id;
      wins += Number(won);
      streak = won ? streak + 1 : 0;
      bestStreak = Math.max(bestStreak, streak);
      form.push(score.points);
    }
    return {
      ...player,
      points,
      roads,
      armies,
      wins,
      streak,
      bestStreak,
      played,
      form,
      bonus: 0,
      total: points,
      rank: 0,
      unresolvedBonus: false,
    };
  });
  for (const [field, amount] of [
    ["roads", rules.road],
    ["armies", rules.army],
  ] as const) {
    const most = Math.max(0, ...rows.map((p) => p[field]));
    if (!most || !amount) continue;
    const leaders = rows.filter((p) => p[field] === most);
    for (const p of leaders) {
      if (leaders.length === 1 || rules.tie === "each") p.bonus += amount;
      else if (rules.tie === "split") p.bonus += amount / leaders.length;
      else if (rules.tie === "pending") p.unresolvedBonus = true;
    }
  }
  // Active-season bonuses are provisional; the UI labels them explicitly.
  rows.forEach((p) => {
    p.total = p.points + p.bonus;
  });
  rows.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  rows.forEach((p, i) => {
    p.rank = i > 0 && rows[i - 1].total === p.total ? rows[i - 1].rank : i + 1;
  });
  return rows;
}

export function progress(players: Profile[], games: Match[], season: Season) {
  const totals: Record<string, number> = Object.fromEntries(
    players.map((p) => [p.name, 0]),
  );
  return games
    .filter((g) => g.tournament_id === season.id && !g.voided_at)
    .sort((a, b) => a.game_number - b.game_number)
    .map((g) => {
      for (const p of players)
        totals[p.name] +=
          g.game_scores.find((s) => s.player_id === p.id)?.points ?? 0;
      return { game: g.game_number, ...totals };
    });
}

export function validateResult(value: unknown) {
  if (!value || typeof value !== "object")
    throw new Error("A game result is required.");
  const v = value as Record<string, unknown>;
  if (!Number.isInteger(v.gameNumber) || Number(v.gameNumber) < 1)
    throw new Error("Choose a valid game number.");
  if (
    typeof v.date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(v.date) ||
    new Date(v.date).toISOString().slice(0, 10) !== v.date
  )
    throw new Error("Choose a valid date.");
  if (v.date > new Date().toISOString().slice(0, 10))
    throw new Error("A result cannot be dated in the future.");
  if (!Array.isArray(v.scores) || v.scores.length !== 4)
    throw new Error("Include all four players.");
  const scores = v.scores as Score[];
  if (new Set(scores.map((s) => s.player_id)).size !== 4)
    throw new Error("Each player must appear once.");
  if (
    scores.some(
      (s) =>
        typeof s.player_id !== "string" ||
        !Number.isInteger(s.points) ||
        s.points < 0 ||
        s.points > 12 ||
        typeof s.longest_road !== "boolean" ||
        typeof s.largest_army !== "boolean",
    )
  )
    throw new Error(
      "Scores must be whole numbers from 0 to 12 with valid achievements.",
    );
  if (scores.filter((s) => s.points >= 10).length !== 1)
    throw new Error("Exactly one winner must score 10–12 points.");
  if (
    scores.filter((s) => s.longest_road).length > 1 ||
    scores.filter((s) => s.largest_army).length > 1
  )
    throw new Error("Only one player can hold each achievement.");
  return { gameNumber: Number(v.gameNumber), date: v.date, scores };
}
