"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import {
  MotionPage,
  Reveal,
  AnimatedNumber,
  TabIndicator,
} from "./LeagueMotion";
import Link from "next/link";
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Crown,
  Flag,
  Flame,
  Hexagon,
  History,
  LayoutDashboard,
  LogOut,
  Plus,
  RefreshCw,
  Route,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Users,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  COLORS,
  League,
  Match,
  Profile,
  Score,
  Season,
  progress,
  seasonRules,
  standings,
} from "@/lib/league";

type View = "season" | "rivalries" | "history" | "club";
export function Avatar({
  player,
  large = false,
}: {
  player: Profile;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      className={`player-avatar ${large ? "avatar-large" : ""}`}
      style={
        { "--player": COLORS[player.name] || "#f2b84b" } as React.CSSProperties
      }
    >
      {player.avatar_url && !failed ? (
        <img
          src={player.avatar_url}
          alt={player.name}
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{player.name.slice(0, 1)}</span>
      )}
    </span>
  );
}
const dateLabel = (date: string) =>
  new Date(date + "T12:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
const pointsLabel = (n: number) => (Number.isInteger(n) ? n : n.toFixed(1));

export default function ChambersApp() {
  const reducedMotion = useReducedMotion();
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<League | null>(null),
    [error, setError] = useState(""),
    [seasonId, setSeasonId] = useState(""),
    [view, setView] = useState<View>("season");
  const [recording, setRecording] = useState(false),
    [creating, setCreating] = useState(false),
    [filter, setFilter] = useState("all"),
    [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/league", { cache: "no-store" });
      if (r.status === 401) {
        location.assign("/login");
        return;
      }
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setData(d);
      setError("");
      setSeasonId((prev) =>
        d.seasons.some((s: Season) => s.id === prev)
          ? prev
          : d.seasons[0]?.id || "",
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not refresh the league.",
      );
    }
  }, []);
  useEffect(() => {
    load();
    const interval = setInterval(() => {
      if (!document.hidden) load();
    }, 30000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);
  const season = data?.seasons.find((s) => s.id === seasonId);
  if (!data || !season)
    return (
      <main className="chamber-app loading-view">
        <Hexagon size={38} />
        <h1>{error ? "Unable to load results" : "Loading results…"}</h1>
        <p>{error || "This should take a moment."}</p>
        <button className="secondary-button" onClick={load}>
          <RefreshCw size={16} />
          Try again
        </button>
      </main>
    );
  const games = data.games
    .filter((g) => g.tournament_id === season.id && !g.voided_at)
    .sort((a, b) => a.game_number - b.game_number);
  const rows = standings(data.players, data.games, season),
    leader = rows[0],
    rules = seasonRules(season);
  const nextNumber =
    Math.max(
      0,
      ...data.games
        .filter((g) => g.tournament_id === season.id)
        .map((g) => g.game_number),
    ) + 1;
  const latest = games.at(-1),
    done = season.status === "completed";
  const isAdmin = data.role === "admin";
  const changeSeason = (id: string) => {
    setSeasonId(id);
    setFilter("all");
  };
  return (
    <main className="chamber-app">
      <header className="app-header">
        <Link href="/" className="wordmark">
          <span className="brand-mark">
            <Hexagon size={23} />
            <span>c</span>
          </span>
          catan<span className="wordmark-light">chambers</span>
        </Link>
        <button
          aria-label="Refresh standings"
          className={`icon-button ${refreshing ? "is-refreshing" : ""}`}
          disabled={refreshing}
          aria-busy={refreshing}
          onClick={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        >
          <RefreshCw size={17} />
        </button>
      </header>
      <div className="season-picker-row">
        <div className="season-picker">
          <select
            aria-label="Select season"
            value={seasonId}
            onChange={(e) => changeSeason(e.target.value)}
          >
            {data.seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name.replace("Catan ", "Season ").replace(".0", "")}
              </option>
            ))}
          </select>
          <ChevronDown size={15} />
        </div>
        <span className={`status-pill ${done ? "complete" : ""}`}>
          <span />
          {done ? "Final standings" : "In play"}
        </span>
      </div>
      {error && (
        <div role="alert" className="notice error-text">
          {error} Showing the last loaded results.
        </div>
      )}
      {notice && (
        <div role="status" className="notice">
          {notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <AnimatePresence mode="wait" initial={false}>
        <MotionPage key={`${view}-${season.id}`} className="view-content">
          {view === "season" && (
            <>
              <section className="season-heading">
                <p className="eyebrow">CATAN CHAMBERS</p>
                <h1>
                  {season.name.replace("Catan ", "Season ").replace(".0", "")}
                </h1>
                <div className="season-meta">
                  <span>
                    {games.length} {games.length === 1 ? "game" : "games"}{" "}
                    played
                  </span>
                  <i />
                  <span>
                    ₹{season.prize_pool.toLocaleString("en-IN")} prize pool
                  </span>
                </div>
              </section>
              {done ? (
                <Link
                  className="recap-link"
                  href={`/recap?season=${season.id}`}
                >
                  <span className="recap-icon">
                    <Sparkles size={19} />
                  </span>
                  <span>
                    <strong>Season recap</strong>
                    <small>Highlights and images to share</small>
                  </span>
                  <ArrowUpRight size={22} />
                </Link>
              ) : (
                <div className="season-progress">
                  <div>
                    <span>Season progress</span>
                    <strong>
                      {games.length} / {season.total_games}
                    </strong>
                  </div>
                  <progress max={season.total_games} value={games.length} />
                </div>
              )}
              {rules.note && (
                <div className="forfeit-note">
                  <Flag size={17} />
                  <span>{rules.note}</span>
                </div>
              )}
              <div className="section-title">
                <h2>Standings</h2>
                <span>
                  {rules.road || rules.army
                    ? done
                      ? "Including bonuses"
                      : "Provisional bonuses"
                    : "Total points"}
                </span>
              </div>
              <section className="standings-list" aria-label="Season standings">
                {rows.map((p, index) => (
                  <Reveal
                    index={index}
                    key={p.id}
                    className={`standing-card ${p.rank === 1 && games.length ? "standing-first" : ""}`}
                    style={
                      { "--player": COLORS[p.name] } as React.CSSProperties
                    }
                  >
                    <div className="standing-main">
                      <span className="rank">
                        {String(p.rank).padStart(2, "0")}
                      </span>
                      <Avatar player={p} />
                      <div className="player-name">
                        <strong>
                          {p.name}
                          {p.rank === 1 && games.length > 0 && (
                            <Crown size={15} />
                          )}
                        </strong>
                        <span>
                          {p.wins} wins <i>·</i>{" "}
                          {p.played ? Math.round((p.wins / p.played) * 100) : 0}
                          % win rate
                        </span>
                      </div>
                      <div className="point-total">
                        <strong>
                          <AnimatedNumber value={p.total} />
                        </strong>
                        <small>PTS</small>
                      </div>
                    </div>
                    <div className="standing-detail">
                      <span>
                        <Route size={14} />
                        {p.roads} roads
                      </span>
                      <span>
                        <Shield size={14} />
                        {p.armies} armies
                      </span>
                      <span className={p.bonus ? "bonus-label" : "gap-label"}>
                        {p.bonus
                          ? `+${pointsLabel(p.bonus)} bonus`
                          : p.rank === 1
                            ? "Leader"
                            : `${pointsLabel(leader.total - p.total)} behind`}
                      </span>
                    </div>
                    {p.unresolvedBonus && (
                      <p className="unresolved">
                        Bonus tied — tiebreak rule pending
                      </p>
                    )}
                  </Reveal>
                ))}
              </section>
              {(rules.road > 0 || rules.army > 0) && (
                <p className="scoring-note">
                  Base points + {rules.road} for most Roads + {rules.army} for
                  most Armies.
                  {!done && " Bonuses settle at the end of the season."}
                </p>
              )}
              <section className="chart-panel">
                <div className="section-title">
                  <div>
                    <p className="eyebrow">PROGRESS</p>
                    <h2>Points over time</h2>
                  </div>
                  <span>Base points</span>
                </div>
                <RaceChart data={data} season={season} />
                <div
                  className="chart-legend"
                  role="group"
                  aria-label="Chart players"
                  tabIndex={0}
                >
                  {data.players.map((p) => (
                    <span key={p.id}>
                      <i style={{ background: COLORS[p.name] }} />
                      {p.name}
                    </span>
                  ))}
                </div>
              </section>
              {latest && (
                <button
                  className="last-game"
                  onClick={() => setView("history")}
                >
                  <span className="small-icon">
                    <History size={19} />
                  </span>
                  <span>
                    <small>LATEST GAME</small>
                    <strong>
                      {
                        data.players.find((p) => p.id === latest.winner_id)
                          ?.name
                      }{" "}
                      won game {latest.game_number}
                    </strong>
                  </span>
                  <ArrowUpRight size={19} />
                </button>
              )}
              <button
                className="text-button"
                onClick={() => setView("rivalries")}
              >
                View player comparisons <ArrowUpRight size={16} />
              </button>
            </>
          )}
          {view === "rivalries" && <Rivalries data={data} season={season} />}
          {view === "history" && (
            <>
              <section className="view-heading">
                <p className="eyebrow">MATCHES</p>
                <h1>Game history</h1>
                <p>
                  {games.length} matches in {season.name}
                </p>
              </section>
              <div
                className="filter-chips"
                role="group"
                aria-label="Filter games by winner"
                tabIndex={0}
              >
                <button
                  className={filter === "all" ? "active" : ""}
                  onClick={() => setFilter("all")}
                >
                  Everyone
                </button>
                {data.players.map((p) => (
                  <button
                    className={filter === p.id ? "active" : ""}
                    key={p.id}
                    onClick={() => setFilter(p.id)}
                  >
                    {p.name} wins
                  </button>
                ))}
              </div>
              <div className="game-list" key={filter}>
                {[...data.games]
                  .filter(
                    (g) =>
                      g.tournament_id === season.id &&
                      (filter === "all" || g.winner_id === filter),
                  )
                  .sort((a, b) => b.game_number - a.game_number)
                  .map((g, index) => (
                    <Reveal key={g.id} index={index}>
                      <GameCard
                        key={g.id}
                        game={g}
                        players={data.players}
                        admin={isAdmin}
                        onChange={async () => {
                          await load();
                          setNotice("Game nullified. Standings recalculated.");
                        }}
                      />
                    </Reveal>
                  ))}
                {!games.length && (
                  <p className="empty-state">No games recorded yet.</p>
                )}
              </div>
            </>
          )}
          {view === "club" && (
            <>
              <section className="view-heading">
                <p className="eyebrow">ALL SEASONS</p>
                <h1>Players</h1>
                <p>
                  {data.games.filter((g) => !g.voided_at).length} games across{" "}
                  {data.seasons.length} seasons.
                </p>
              </section>
              <div className="career-grid">
                {data.players.map((p) => {
                  const played = data.games.filter(
                    (g) =>
                      !g.voided_at &&
                      g.game_scores.some((s) => s.player_id === p.id),
                  );
                  const wins = played.filter(
                    (g) => g.winner_id === p.id,
                  ).length;
                  return (
                    <Reveal className="career-card" key={p.id}>
                      <Avatar player={p} large />
                      <h2>{p.name}</h2>
                      <strong>
                        <AnimatedNumber value={wins} />
                        <small> career wins</small>
                      </strong>
                      <span>
                        {played.length
                          ? Math.round((wins / played.length) * 100)
                          : 0}
                        % win rate
                      </span>
                    </Reveal>
                  );
                })}
              </div>
              <div className="section-title">
                <h2>Season archive</h2>
              </div>
              {data.seasons.map((s) => (
                <button
                  key={s.id}
                  className="archive-row"
                  onClick={() => {
                    changeSeason(s.id);
                    setView("season");
                  }}
                >
                  <Trophy size={20} />
                  <span>
                    <strong>{s.name}</strong>
                    <small>
                      {s.status === "completed" ? "Completed" : "In play"} ·{" "}
                      {
                        data.games.filter(
                          (g) => g.tournament_id === s.id && !g.voided_at,
                        ).length
                      }{" "}
                      games
                    </small>
                  </span>
                  <ArrowUpRight size={18} />
                </button>
              ))}

              {isAdmin && (
                <button
                  className="secondary-button full-width"
                  onClick={() => setCreating(true)}
                >
                  <Plus size={17} />
                  Create next season
                </button>
              )}
              <button
                className="sign-out"
                onClick={async () => {
                  await fetch("/api/session", { method: "DELETE" });
                  location.assign("/login");
                }}
              >
                <LogOut size={16} />
                Sign out
              </button>
            </>
          )}
        </MotionPage>
      </AnimatePresence>
      {isAdmin && season.status === "active" && (
        <button className="record-fab" onClick={() => setRecording(true)}>
          <Plus size={19} />
          Record game
        </button>
      )}
      <nav className="bottom-nav" aria-label="Main navigation">
        {(
          [
            { id: "season", label: "Season", icon: LayoutDashboard },
            { id: "rivalries", label: "Rivalries", icon: Swords },
            { id: "history", label: "Games", icon: History },
            { id: "club", label: "Players", icon: Users },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            aria-current={view === item.id ? "page" : undefined}
            className={view === item.id ? "active" : ""}
            onClick={() => {
              setView(item.id);
              window.scrollTo({
                top: 0,
                behavior: reducedMotion ? "instant" : "smooth",
              });
            }}
          >
            {view === item.id && <TabIndicator />}
            <item.icon size={21} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <RecordDialog
        open={recording}
        close={() => setRecording(false)}
        data={data}
        season={season}
        number={nextNumber}
        saved={async () => {
          setRecording(false);
          await load();
          setNotice("Game recorded. Standings are up to date.");
        }}
      />
      <CreateDialog
        open={creating}
        close={() => setCreating(false)}
        saved={async (id) => {
          setCreating(false);
          setSeasonId(id);
          await load();
          setView("season");
        }}
      />
    </main>
  );
}

function RaceChart({ data, season }: { data: League; season: Season }) {
  const reducedMotion = useReducedMotion();
  const chart = progress(data.players, data.games, season);
  if (!chart.length)
    return (
      <p className="empty-state">The chart appears after the first game.</p>
    );
  return (
    <div className="race-chart">
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart
          data={chart}
          margin={{ top: 12, right: 8, left: -22, bottom: 0 }}
        >
          <CartesianGrid
            stroke="#e6ded1"
            vertical={false}
            strokeDasharray="3 6"
          />
          <XAxis
            dataKey="game"
            stroke="#657083"
            tickLine={false}
            axisLine={false}
            fontSize={12}
            minTickGap={25}
          />
          <YAxis
            stroke="#657083"
            tickLine={false}
            axisLine={false}
            fontSize={12}
          />
          <Tooltip
            contentStyle={{
              background: "#ffffff",
              border: "1px solid #e6ded1",
              borderRadius: 12,
              fontSize: 14,
            }}
            labelFormatter={(label) => `Game ${label}`}
          />
          {data.players.map((p) => (
            <Area
              key={p.id}
              type="monotone"
              dataKey={p.name}
              stroke={COLORS[p.name]}
              strokeWidth={2.5}
              fill={COLORS[p.name]}
              fillOpacity={0.035}
              isAnimationActive={!reducedMotion}
              animationDuration={750}
              animationEasing="ease-out"
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
function Rivalries({ data, season }: { data: League; season: Season }) {
  const rows = standings(data.players, data.games, season),
    games = data.games.filter(
      (g) => g.tournament_id === season.id && !g.voided_at,
    );
  const [a, setA] = useState(data.players[0]?.id),
    [b, setB] = useState(data.players[1]?.id);
  const left = rows.find((p) => p.id === a)!,
    right = rows.find((p) => p.id === b)!;
  const ahead = (x: string, y: string) =>
    games.filter(
      (g) =>
        (g.game_scores.find((s) => s.player_id === x)?.points ?? 0) >
        (g.game_scores.find((s) => s.player_id === y)?.points ?? 0),
    ).length;
  const previous = [...data.seasons].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true }),
  );
  const index = previous.findIndex((s) => s.id === season.id);
  const prev = previous[index - 1];
  const prevGames = prev
    ? data.games
        .filter((g) => g.tournament_id === prev.id && !g.voided_at)
        .sort((a, b) => a.game_number - b.game_number)
        .slice(0, games.length)
    : [];
  const awards = [
    { title: "Most wins", field: "wins", icon: Trophy },
    { title: "Longest win streak", field: "bestStreak", icon: Flame },
    { title: "Most Roads", field: "roads", icon: Route },
    { title: "Most Armies", field: "armies", icon: Shield },
  ] as const;
  return (
    <>
      <section className="view-heading">
        <p className="eyebrow">SEASON STATS</p>
        <h1>Rivalries</h1>
      </section>
      <div className="awards-grid">
        {awards.map((award) => {
          const max = Math.max(0, ...rows.map((p) => p[award.field]));
          return (
            <Reveal className="award-card" key={award.title}>
              <award.icon size={21} />
              <span>{award.title}</span>
              <strong>
                <AnimatedNumber value={max} />
              </strong>
              <small>
                {max
                  ? rows
                      .filter((p) => p[award.field] === max)
                      .map((p) => p.name)
                      .join(" & ")
                  : "No results yet"}
              </small>
            </Reveal>
          );
        })}
      </div>
      <section className="head-to-head">
        <div className="section-title">
          <h2>Head to head</h2>
          <Swords size={18} />
        </div>
        <div className="versus-pickers">
          <select
            aria-label="First player"
            value={a}
            onChange={(e) => {
              setA(e.target.value);
              if (e.target.value === b) setB(a);
            }}
          >
            {data.players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <span>VS</span>
          <select
            aria-label="Second player"
            value={b}
            onChange={(e) => {
              setB(e.target.value);
              if (e.target.value === a) setA(b);
            }}
          >
            {data.players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="versus-faces">
          <Avatar player={left} large />
          <span>
            {ahead(a, b)}
            <small>—</small>
            {ahead(b, a)}
          </span>
          <Avatar player={right} large />
        </div>
        <p className="scoring-note">
          Games finishing ahead on base points.{" "}
          {games.length - ahead(a, b) - ahead(b, a)} tied.
        </p>
        {(["total", "wins", "roads", "armies"] as const).map((field) => (
          <div className="versus-row" key={field}>
            <strong>{pointsLabel(left[field])}</strong>
            <span>
              {
                {
                  total: "Season points",
                  wins: "Wins",
                  roads: "Longest Roads",
                  armies: "Largest Armies",
                }[field]
              }
            </span>
            <strong>{pointsLabel(right[field])}</strong>
          </div>
        ))}
      </section>
      <section className="chart-panel">
        <div className="section-title">
          <h2>Recent form</h2>
          <span>Last five games</span>
        </div>
        {rows.map((p) => (
          <div className="form-row" key={p.id}>
            <strong>{p.name}</strong>
            <div>
              {p.form.slice(-5).map((score, i) => (
                <span className={score >= 10 ? "win" : ""} key={i}>
                  {score}
                </span>
              ))}
            </div>
            <span>
              {p.played ? (p.points / p.played).toFixed(1) : "0.0"}
              <small> avg</small>
            </span>
          </div>
        ))}
      </section>
      {prev && (
        <section className="chart-panel">
          <div className="section-title">
            <div>
              <p className="eyebrow">THEN VS NOW</p>
              <h2>Same stage, last season</h2>
            </div>
          </div>
          <p className="scoring-note">
            Base points after {Math.min(games.length, prevGames.length)} games
            vs {prev.name}.
          </p>
          {rows.map((p) => {
            const count = Math.min(games.length, prevGames.length);
            const now = games
              .slice(0, count)
              .reduce(
                (n, g) =>
                  n +
                  (g.game_scores.find((s) => s.player_id === p.id)?.points ||
                    0),
                0,
              );
            const before = prevGames.reduce(
              (n, g) =>
                n +
                (g.game_scores.find((s) => s.player_id === p.id)?.points || 0),
              0,
            );
            return (
              <div className="comparison-row" key={p.id}>
                <span>{p.name}</span>
                <span>
                  {before} → {now}
                </span>
                <strong className={now >= before ? "positive" : "negative"}>
                  {now > before ? "+" : ""}
                  {now - before}
                </strong>
              </div>
            );
          })}
        </section>
      )}
      <section className="chart-panel">
        <div className="section-title">
          <h2>Points gap</h2>
        </div>
        {season.status === "completed" ? (
          <p className="scoring-note">
            Season complete. {rows[0]?.name} finished{" "}
            {pointsLabel((rows[0]?.total || 0) - (rows[1]?.total || 0))} points
            ahead.
          </p>
        ) : (
          rows.slice(1).map((p) => (
            <div className="comparison-row" key={p.id}>
              <span>{p.name}</span>
              <span>
                {Math.max(0, season.total_games - games.length)} games left
              </span>
              <strong>
                {Math.max(0, season.total_games - games.length)
                  ? (
                      (rows[0].total - p.total + 1) /
                      (season.total_games - games.length)
                    ).toFixed(1)
                  : "—"}
                <small> / game</small>
              </strong>
            </div>
          ))
        )}
        {season.status !== "completed" && (
          <p className="scoring-note">
            Average points to gain on the leader each game to finish ahead,
            assuming bonus holders stay the same. A scenario, not a win
            probability.
          </p>
        )}
      </section>
    </>
  );
}
function GameCard({
  game,
  players,
  admin,
  onChange,
}: {
  game: Match;
  players: Profile[];
  admin: boolean;
  onChange: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <article className={`game-card ${game.voided_at ? "voided" : ""}`}>
      <div className="game-card-header">
        <span>GAME {String(game.game_number).padStart(2, "0")}</span>
        <span>{dateLabel(game.date)}</span>
      </div>
      <h2>
        {game.voided_at
          ? "Nullified"
          : `${players.find((p) => p.id === game.winner_id)?.name} won`}
        {!game.voided_at && <Trophy size={19} />}
      </h2>
      <div className="game-score-grid">
        {players.map((p) => {
          const s = game.game_scores.find((s) => s.player_id === p.id);
          return (
            <div key={p.id}>
              <span style={{ color: COLORS[p.name] }}>{p.name}</span>
              <strong>{s?.points ?? "—"}</strong>
              <small>
                {s?.longest_road && <Route size={13} />}
                {s?.largest_army && <Shield size={13} />}
              </small>
            </div>
          );
        })}
      </div>
      {admin && !game.voided_at && (
        <button className="nullify-button" onClick={() => setOpen(true)}>
          Nullify game
        </button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="chamber-dialog">
          <DialogTitle>Nullify game {game.game_number}?</DialogTitle>
          <DialogDescription>
            The result stays in history and is removed from the standings.
          </DialogDescription>
          <label htmlFor={`reason-${game.id}`}>Reason</label>
          <input
            id={`reason-${game.id}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            placeholder="What happened?"
          />
          <button
            className="primary-button"
            disabled={busy || reason.trim().length < 3}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await fetch("/api/games/delete", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ gameId: game.id, reason }),
                });
                const d = await r.json();
                if (!r.ok) throw new Error(d.error);
                setOpen(false);
                await onChange();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Could not nullify.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Confirm nullification
          </button>
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </article>
  );
}
function RecordDialog({
  open,
  close,
  data,
  season,
  number,
  saved,
}: {
  open: boolean;
  close: () => void;
  data: League;
  season: Season;
  number: number;
  saved: () => Promise<void>;
}) {
  const [scores, setScores] = useState<Score[]>([]),
    [date, setDate] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [requestId, setRequestId] = useState("");
  const playerIds = data.players.map((p) => p.id).join(",");
  useEffect(() => {
    if (open) {
      setScores(
        playerIds.split(",").map((id) => ({
          player_id: id,
          points: 0,
          longest_road: false,
          largest_army: false,
        })),
      );
      setDate(new Date().toLocaleDateString("en-CA"));
      setRequestId(crypto.randomUUID());
      setError("");
    }
  }, [open, playerIds, season.id]);
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="chamber-dialog">
        <DialogTitle>Record game {number}</DialogTitle>
        <DialogDescription>
          {season.name} · Enter this game’s points, not cumulative totals.
        </DialogDescription>
        <label htmlFor="played-date">Date played</label>
        <input
          id="played-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        {scores.map((s) => {
          const p = data.players.find((p) => p.id === s.player_id)!;
          return (
            <div className="entry-player" key={s.player_id}>
              <div>
                <Avatar player={p} />
                <strong>{p.name}</strong>
                <input
                  type="number"
                  aria-label={`${p.name} points`}
                  min={0}
                  max={12}
                  value={s.points}
                  onChange={(e) =>
                    setScores((prev) =>
                      prev.map((v) =>
                        v.player_id === s.player_id
                          ? { ...v, points: Number(e.target.value) }
                          : v,
                      ),
                    )
                  }
                />
              </div>
              <div className="entry-achievements">
                {(["longest_road", "largest_army"] as const).map((field) => (
                  <button
                    key={field}
                    aria-pressed={s[field]}
                    className={s[field] ? "selected" : ""}
                    onClick={() =>
                      setScores((prev) =>
                        prev.map((v) => ({
                          ...v,
                          [field]:
                            v.player_id === s.player_id ? !v[field] : false,
                        })),
                      )
                    }
                  >
                    {field === "longest_road" ? (
                      <Route size={14} />
                    ) : (
                      <Shield size={14} />
                    )}
                    {field === "longest_road" ? "Road" : "Army"}
                    {s[field] && <Check size={13} />}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <button
          className="primary-button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const r = await fetch("/api/games", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  requestId,
                  seasonId: season.id,
                  gameNumber: number,
                  date,
                  scores,
                }),
              });
              const d = await r.json();
              if (!r.ok) throw new Error(d.error);
              await saved();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not save.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Recording…" : "Record result"}
          <ArrowUpRight size={17} />
        </button>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
function CreateDialog({
  open,
  close,
  saved,
}: {
  open: boolean;
  close: () => void;
  saved: (seasonId: string) => Promise<void>;
}) {
  const [name, setName] = useState(""),
    [count, setCount] = useState(20),
    [prize, setPrize] = useState(10000),
    [tie, setTie] = useState(""),
    [bonuses, setBonuses] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="chamber-dialog">
        <DialogTitle>Create season</DialogTitle>
        <DialogDescription>
          Set the rules before the first game.
        </DialogDescription>
        <label htmlFor="season-name">Season name</label>
        <input
          id="season-name"
          placeholder="Catan 4.0"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="two-fields">
          <label>
            Games
            <input
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
          </label>
          <label>
            Prize · INR
            <input
              type="number"
              min={0}
              value={prize}
              onChange={(e) => setPrize(Number(e.target.value))}
            />
          </label>
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={bonuses}
            onChange={(e) => setBonuses(e.target.checked)}
          />
          +10 most Roads / +10 most Armies
        </label>
        <label htmlFor="tie-rule">If achievement leaders tie</label>
        <select
          id="tie-rule"
          value={tie}
          onChange={(e) => setTie(e.target.value)}
        >
          <option value="" disabled>
            Choose the rule
          </option>
          <option value="each">Each tied player gets +10</option>
          <option value="split">Split the +10 equally</option>
          <option value="none">No bonus on a tie</option>
        </select>
        <button
          className="primary-button"
          disabled={busy || !name.trim() || !tie}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const r = await fetch("/api/tournaments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name,
                  totalGames: count,
                  prizePool: prize,
                  bonusTieRule: tie,
                  roadBonus: bonuses ? 10 : 0,
                  armyBonus: bonuses ? 10 : 0,
                }),
              });
              const d = await r.json();
              if (!r.ok) throw new Error(d.error);
              await saved(d.seasonId);
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Could not create season.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Create season
          <Plus size={17} />
        </button>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
