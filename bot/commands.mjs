import { createHash } from "node:crypto";
import { standings, validateResult } from "../src/lib/league.ts";

export function parseResult(text, league) {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((s) => s.trim());
  if (lines[0] !== "!catan result") return null;
  if (lines.length !== 10)
    throw new Error("Use the complete 10-line result template. No extra text.");
  const fields = new Map();
  for (const line of lines.slice(1)) {
    const match = line.match(/^([^:]+):\s*(.+)$/);
    if (!match || fields.has(match[1]))
      throw new Error("Malformed or repeated template field.");
    fields.set(match[1], match[2]);
  }
  const season = league.seasons.find(
    (s) => s.name.toLowerCase() === fields.get("Season")?.toLowerCase(),
  );
  if (!season)
    throw new Error("Season not found. Use its exact name from the app.");
  const expected = [
    "Season",
    "Game",
    "Date",
    ...league.players.map((p) => p.name),
    "Road",
    "Army",
  ];
  if (expected.some((k) => !fields.has(k)) || fields.size !== expected.length)
    throw new Error(
      "Include Season, Game, Date, all four names, Road, and Army.",
    );
  for (const achievement of ["Road", "Army"])
    if (
      fields.get(achievement) !== "None" &&
      !league.players.some((p) => p.name === fields.get(achievement))
    )
      throw new Error(`${achievement} must be a player name or None.`);
  if (
    !/^\d+$/.test(fields.get("Game")) ||
    league.players.some((p) => !/^\d+$/.test(fields.get(p.name)))
  )
    throw new Error("Use whole numbers for the game and points.");
  const result = validateResult({
    gameNumber: Number(fields.get("Game")),
    date: fields.get("Date"),
    scores: league.players.map((p) => ({
      player_id: p.id,
      points: Number(fields.get(p.name)),
      longest_road: fields.get("Road") === p.name,
      largest_army: fields.get("Army") === p.name,
    })),
  });
  return { ...result, seasonId: season.id };
}
export function requestId(messageId) {
  const h = createHash("sha256")
    .update("catan-chambers:" + messageId)
    .digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
export function statAnswer(message, league) {
  const q = message
    .replace(/^!catan\s*/i, "")
    .trim()
    .toLowerCase();
  const seasonNumber = q.match(/(?:season|catan|s)\s*(\d+)(?:\.0)?/i)?.[1];
  const season = seasonNumber
    ? league.seasons.find(
        (s) => s.name.toLowerCase() === `catan ${seasonNumber}.0`,
      )
    : league.seasons[0];
  if (!season)
    return "I could not find that season. Try “!catan standings season 3”.";
  const rows = standings(league.players, league.games, season);
  const games = league.games
    .filter((g) => g.tournament_id === season.id && !g.voided_at)
    .sort((a, b) => a.game_number - b.game_number);
  const selected = rows.filter((p) =>
    new RegExp(`\\b${p.name.toLowerCase()}\\b`).test(q),
  );
  const prefix = `${season.name} · ${games.length} games\n`;
  if (/^help$|^template$/.test(q))
    return "Chamber commands:\n!catan standings season 3\n!catan Tamim stats season 3\n!catan Ezzy vs Tamim season 3\n!catan who won the last game?\n!catan most roads season 3\n!catan game 10 season 3\n!catan screenshot season 3\nOnly Tamim can record results. Use the template in The club tab.";
  const gameNumber = q.match(/\bgame\s+(\d+)\b/)?.[1];
  if (gameNumber || /\blast\b|\blatest\b/.test(q)) {
    const game = gameNumber
      ? games.find((g) => g.game_number === Number(gameNumber))
      : games.at(-1);
    if (!game) return prefix + "No matching game.";
    return (
      prefix +
      `Game ${game.game_number} · ${game.date}\nWinner: ${league.players.find((p) => p.id === game.winner_id)?.name}\n` +
      [...game.game_scores]
        .sort((a, b) => b.points - a.points)
        .map(
          (s) =>
            `${league.players.find((p) => p.id === s.player_id)?.name}: ${s.points}${s.longest_road ? " · Road" : ""}${s.largest_army ? " · Army" : ""}`,
        )
        .join("\n")
    );
  }
  if (selected.length === 2 && /\bvs\b|versus|compare|head.to.head/.test(q)) {
    const [a, b] = selected;
    const count = (x, y) =>
      games.filter(
        (g) =>
          (g.game_scores.find((s) => s.player_id === x.id)?.points || 0) >
          (g.game_scores.find((s) => s.player_id === y.id)?.points || 0),
      ).length;
    return (
      prefix +
      `${a.name} vs ${b.name}\nFinished ahead: ${count(a, b)}–${count(b, a)} (${games.length - count(a, b) - count(b, a)} ties)\nSeason points: ${a.total}–${b.total}\nWins: ${a.wins}–${b.wins}`
    );
  }
  if (selected.length === 1) {
    const p = selected[0];
    return (
      prefix +
      `${p.name} · rank ${p.rank}\n${p.total} season points (${p.points} base + ${p.bonus} bonus)\n${p.wins} wins · ${p.played ? Math.round((p.wins / p.played) * 100) : 0}% win rate\n${p.roads} Roads · ${p.armies} Armies\nBest streak: ${p.bestStreak}\nAverage: ${p.played ? (p.points / p.played).toFixed(1) : "0"} points\nLast five: ${p.form.slice(-5).join(", ")}`
    );
  }
  if (/most|highest|best|leader/.test(q)) {
    const field = /road/.test(q)
      ? "roads"
      : /arm/.test(q)
        ? "armies"
        : /streak/.test(q)
          ? "bestStreak"
          : /win/.test(q)
            ? "wins"
            : "total";
    const max = Math.max(0, ...rows.map((p) => p[field]));
    return (
      prefix +
      `${rows
        .filter((p) => p[field] === max)
        .map((p) => p.name)
        .join(
          " & ",
        )}: ${max} ${{ roads: "Longest Roads", armies: "Largest Armies", bestStreak: "consecutive wins", wins: "wins", total: "season points" }[field]}.`
    );
  }
  if (/standings|score|points|rank|winning|won.*season|champion/.test(q))
    return (
      prefix +
      rows
        .map(
          (p) =>
            `${p.rank}. ${p.name}: ${p.total}${p.bonus ? ` (${p.points} + ${p.bonus} bonus)` : ""} · ${p.wins} wins`,
        )
        .join("\n")
    );
  return "I answer Catan Chambers stats from recorded games. Try “!catan standings”, “!catan Anas stats”, or “!catan help”.";
}
