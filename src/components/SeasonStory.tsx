"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowDownToLine,
  ChevronLeft,
  ChevronRight,
  Crown,
  Flag,
  Route,
  Shield,
  Trophy,
  X,
} from "lucide-react";
import { League, Season, seasonRules, standings } from "@/lib/league";
import { Avatar } from "./ChambersApp";

export default function SeasonStory({
  data,
  season,
}: {
  data: League;
  season: Season;
}) {
  const [slide, setSlide] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const rows = standings(data.players, data.games, season),
    winner = rows[0],
    rules = seasonRules(season);
  const games = data.games.filter(
    (g) => g.tournament_id === season.id && !g.voided_at,
  );
  const largest = Math.max(
    0,
    ...games.flatMap((g) => g.game_scores.map((s) => s.points)),
  );
  const bigGames = games.filter((g) =>
    g.game_scores.some((s) => s.points === largest),
  );
  const streak = Math.max(0, ...rows.map((p) => p.bestStreak));
  const roads = Math.max(0, ...rows.map((p) => p.roads)),
    armies = Math.max(0, ...rows.map((p) => p.armies));
  if (!winner || !games.length)
    return (
      <main className="story-shell">
        <Link href="/">← Back to the league</Link>
        <h1>No highlights yet.</h1>
      </main>
    );
  return (
    <main className={`story-shell story-slide-${slide}`}>
      <div
        className="story-progress"
        aria-label={`Recap page ${slide + 1} of 3`}
      >
        {[0, 1, 2].map((n) => (
          <button
            key={n}
            aria-label={`Go to recap page ${n + 1}`}
            onClick={() => setSlide(n)}
          >
            <span className={n <= slide ? "seen" : ""} />
          </button>
        ))}
      </div>
      <header className="story-header">
        <span>
          CATAN CHAMBERS <b> / </b>
          {season.name.replace("Catan ", "S").replace(".0", "")}
        </span>
        <Link href="/" aria-label="Close season recap">
          <X size={21} />
        </Link>
      </header>
      <div className="story-body" key={slide}>
        {slide === 0 && (
          <>
            <p className="eyebrow">
              {season.status === "completed"
                ? "THE SEASON BELONGED TO"
                : "LEADING THE CHAMBER"}
            </p>
            <h1>
              {winner.name}
              <span>
                ran the
                <br />
                table.
              </span>
            </h1>
            <div className="story-crown">
              <Crown size={48} />
              <Avatar player={winner} large />
            </div>
            <div className="story-hero-number">
              {winner.total}
              <span>SEASON POINTS</span>
            </div>
            <div className="story-metrics">
              <div>
                <strong>{winner.wins}</strong>
                <span>WINS</span>
              </div>
              <div>
                <strong>
                  {Math.round((winner.wins / winner.played) * 100)}%
                </strong>
                <span>WIN RATE</span>
              </div>
              <div>
                <strong>+{winner.total - (rows[1]?.total || 0)}</strong>
                <span>WINNING MARGIN</span>
              </div>
            </div>
            <p className="story-caption">
              {games.length} games. Four friends.
              <br />
              One very satisfied champion.
            </p>
          </>
        )}
        {slide === 1 && (
          <>
            <p className="eyebrow">THE HIGHLIGHT REEL</p>
            <h1>
              Some things
              <br />
              <span>
                deserve a<br />
                mention.
              </span>
            </h1>
            <div className="story-highlights">
              <div>
                <Trophy />
                <span>
                  <small>THE BIGGEST GAME</small>
                  <strong>{largest} points</strong>
                  <p>
                    {[
                      ...new Set(
                        bigGames.flatMap((g) =>
                          g.game_scores
                            .filter((s) => s.points === largest)
                            .map(
                              (s) =>
                                data.players.find((p) => p.id === s.player_id)
                                  ?.name,
                            ),
                        ),
                      ),
                    ].join(" & ")}
                  </p>
                </span>
              </div>
              <div>
                <Crown />
                <span>
                  <small>THE HOT STREAK</small>
                  <strong>{streak} wins in a row</strong>
                  <p>
                    {rows
                      .filter((p) => p.bestStreak === streak)
                      .map((p) => p.name)
                      .join(" & ")}
                  </p>
                </span>
              </div>
              <div>
                <Route />
                <span>
                  <small>ROAD ROYALTY</small>
                  <strong>{roads} Longest Roads</strong>
                  <p>
                    {rows
                      .filter((p) => p.roads === roads)
                      .map((p) => p.name)
                      .join(" & ")}
                  </p>
                </span>
              </div>
              <div>
                <Shield />
                <span>
                  <small>ARMY COMMAND</small>
                  <strong>{armies} Largest Armies</strong>
                  <p>
                    {rows
                      .filter((p) => p.armies === armies)
                      .map((p) => p.name)
                      .join(" & ")}
                  </p>
                </span>
              </div>
            </div>
          </>
        )}
        {slide === 2 && (
          <>
            <p className="eyebrow">THE FINAL RECEIPTS</p>
            <h1>
              Bragging rights.
              <br />
              <span>
                Officially
                <br />
                assigned.
              </span>
            </h1>
            <div className="story-standings">
              {rows.map((p) => (
                <div key={p.id}>
                  <span>{String(p.rank).padStart(2, "0")}</span>
                  <Avatar player={p} />
                  <strong>{p.name}</strong>
                  <b>
                    {p.total}
                    <small>
                      {p.bonus ? `${p.points} + ${p.bonus} bonus` : "points"}
                    </small>
                  </b>
                </div>
              ))}
            </div>
            {rules.note && (
              <div className="story-forfeit">
                <Flag size={20} />
                <p>{rules.note}</p>
              </div>
            )}
            <div className="story-prize">
              <span>ON THE LINE</span>
              <strong>₹{season.prize_pool.toLocaleString("en-IN")}</strong>
            </div>
          </>
        )}
      </div>
      <footer className="story-footer">
        <div>
          <span>{season.name.toUpperCase()}</span>
          <span>{games.length} GAMES · THE INNER CIRCLE</span>
        </div>
        <div className="story-controls">
          <button
            className="story-step"
            aria-label="Previous recap page"
            disabled={slide === 0}
            onClick={() => setSlide((n) => n - 1)}
          >
            <ChevronLeft size={23} />
          </button>
          <button
            className="story-save"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const r = await fetch(
                  `/api/recap?season=${season.id}&slide=${slide}`,
                );
                if (!r.ok)
                  throw new Error("Could not export story. Try again.");
                const blob = await r.blob();
                const file = new File(
                  [blob],
                  `${season.name.replace(/\s/g, "-")}-recap-${slide + 1}.png`,
                  { type: "image/png" },
                );
                if (navigator.canShare?.({ files: [file] }))
                  await navigator.share({ files: [file], title: season.name });
                else {
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = file.name;
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 10000);
                }
              } catch (e) {
                if (!(e instanceof Error && e.name === "AbortError"))
                  setError(
                    e instanceof Error ? e.message : "Could not export.",
                  );
              } finally {
                setBusy(false);
              }
            }}
          >
            <ArrowDownToLine size={17} />
            {busy ? "Preparing…" : "Save story"}
          </button>
          <button
            className="story-step"
            aria-label="Next recap page"
            disabled={slide === 2}
            onClick={() => setSlide((n) => n + 1)}
          >
            <ChevronRight size={23} />
          </button>
        </div>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
      </footer>
    </main>
  );
}
