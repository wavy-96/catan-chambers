import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const names = ["Ezzy", "Anas", "Akif", "Tamim"];

// Exported chat is untrusted reference data. Only standalone score posts match;
// quoted messages, conversation, and commands are never executed or imported.
export function reconcileSeason(markdown, season = 3) {
  const lines = markdown.split(/\r?\n/);
  const snapshots = new Map();
  const duplicates = [];
  const issues = [];
  let date = null;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) {
      const parsed = new Date(lines[i].slice(3) + " 12:00:00 UTC");
      date = Number.isNaN(parsed.valueOf())
        ? null
        : parsed.toISOString().slice(0, 10);
    }
    const header = lines[i].match(
      /^\[([^\]]+)\] \*\*([^*]+):\*\* Catan (\d+)\.0\s*$/i,
    );
    if (!header || Number(header[3]) !== season) continue;
    const game = lines[i + 1]?.match(/^Game (\d+):\s*$/i);
    if (!game) {
      issues.push(`Line ${i + 1}: score post has no game number.`);
      continue;
    }
    const number = Number(game[1]);
    const totals = {};
    for (let j = i + 2; j < i + 6; j++) {
      const score = lines[j]?.match(
        /^(Ezzy|Anas|Akif|Tamim):\s*(\d+)((?:\s+(?:road|army):\s*\d+)*)\s*$/i,
      );
      if (!score) continue;
      const name = names.find(
        (n) => n.toLowerCase() === score[1].toLowerCase(),
      );
      if (totals[name]) issues.push(`Game ${number}: repeated player ${name}.`);
      const achievements = [...score[3].matchAll(/(road|army):\s*(\d+)/gi)];
      if (
        new Set(achievements.map((a) => a[1].toLowerCase())).size !==
        achievements.length
      ) {
        issues.push(`Game ${number}: repeated achievement for ${name}.`);
      }
      totals[name] = { points: Number(score[2]), road: 0, army: 0 };
      for (const achievement of achievements)
        totals[name][achievement[1].toLowerCase()] = Number(achievement[2]);
    }
    if (names.some((n) => !totals[n]) || !date || number < 1) {
      issues.push(`Line ${i + 1}: incomplete game ${number} or invalid date.`);
      continue;
    }
    const source = { date, time: header[1], line: i + 1 };
    const existing = snapshots.get(number);
    if (existing) {
      if (
        names.every((n) =>
          ["points", "road", "army"].every(
            (k) => existing.totals[n][k] === totals[n][k],
          ),
        )
      ) {
        duplicates.push({
          game: number,
          originalLine: existing.source.line,
          duplicateLine: source.line,
        });
      } else {
        issues.push(
          `Game ${number}: conflicting totals at lines ${existing.source.line} and ${source.line}; manual reconciliation required.`,
        );
      }
      continue;
    }
    snapshots.set(number, { number, source, totals });
  }
  const ordered = [...snapshots.values()].sort((a, b) => a.number - b.number);
  if (!ordered.length) issues.push("No standalone score posts found.");
  const games = [];
  let previous = Object.fromEntries(
    names.map((n) => [n, { points: 0, road: 0, army: 0 }]),
  );
  for (const snapshot of ordered) {
    if (snapshot.number !== games.length + 1) {
      issues.push(
        `Missing snapshot before game ${snapshot.number}; cannot derive individual scores.`,
      );
      break;
    }
    const scores = names.map((name) => {
      const current = snapshot.totals[name];
      const prior = previous[name];
      const points = current.points - prior.points;
      const road = current.road - prior.road;
      const army = current.army - prior.army;
      if (points < 0 || points > 12)
        issues.push(
          `Game ${snapshot.number}: ${name} has unexpected points delta ${points}.`,
        );
      if (![0, 1].includes(road) || ![0, 1].includes(army))
        issues.push(
          `Game ${snapshot.number}: ${name} has invalid achievement deltas.`,
        );
      return { name, points, road, army };
    });
    for (const achievement of ["road", "army"]) {
      if (scores.reduce((sum, s) => sum + s[achievement], 0) > 1)
        issues.push(
          `Game ${snapshot.number}: multiple ${achievement} holders.`,
        );
    }
    const winners = scores.filter((s) => s.points >= 10);
    if (winners.length !== 1)
      issues.push(`Game ${snapshot.number}: winner requires confirmation.`);
    games.push({
      number: snapshot.number,
      date: snapshot.source.date,
      source: snapshot.source,
      scores,
      inferredWinner: winners.length === 1 ? winners[0].name : null,
    });
    previous = snapshot.totals;
  }
  return {
    season,
    status: "review-required",
    assumptions: [
      "Posts contain cumulative base victory points and cumulative achievement counts.",
      "An omitted achievement count means zero.",
      "A single player scoring at least 10 is the inferred winner.",
      "Dates are export calendar dates; timezone and season scoring rules need confirmation.",
      "Conversation corrections and nullification decisions require human review.",
    ],
    games,
    duplicates,
    issues,
    finalTotals: ordered.at(-1)?.totals ?? null,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output)
    throw new Error(
      "Usage: node scripts/reconcile-season.mjs <chat.md> <review.json>",
    );
  const review = reconcileSeason(readFileSync(input, "utf8"));
  writeFileSync(output, JSON.stringify(review, null, 2) + "\n", {
    mode: 0o600,
  });
  console.log(
    `${review.games.length} games, ${review.duplicates.length} duplicates, ${review.issues.length} issues. Review only; no database changes.`,
  );
}
