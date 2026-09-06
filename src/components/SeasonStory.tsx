"use client";
import { GameIcon } from "./GameIcon";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { MotionPage, AnimatedNumber } from "./LeagueMotion";
import Link from "next/link";
import {
  ArrowDownToLine,
  Share2,
  ChevronLeft,
  ChevronRight,
  Flag,
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
  const [direction, setDirection] = useState(1);
  const [slide, setSlide] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [exported, setExported] = useState<{ key: string; file: File } | null>(
    null,
  );
  const [exportError, setExportError] = useState("");
  const [retry, setRetry] = useState(0);
  const cache = useRef(new Map<string, File>());
  const exportKey = `${season.id}:${slide}`;
  const file = exported?.key === exportKey ? exported.file : null;
  const canShareImage =
    !!file &&
    typeof navigator !== "undefined" &&
    !!navigator.canShare?.({ files: [file] });
  // Prepare the PNG before the tap. iOS requires navigator.share to run
  // directly in the user's gesture, without awaiting a network request.
  useEffect(() => {
    const controller = new AbortController();
    setExportError("");
    setError("");
    const cached = cache.current.get(exportKey);
    if (cached) {
      setExported({ key: exportKey, file: cached });
      return;
    }
    fetch(`/api/recap?season=${season.id}&slide=${slide}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to prepare the image.");
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        const image = new File(
          [blob],
          `${season.name.replace(/\s/g, "-")}-recap-${slide + 1}.png`,
          { type: "image/png" },
        );
        cache.current.set(exportKey, image);
        setExported({ key: exportKey, file: image });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setExportError(error.message);
      });
    return () => controller.abort();
  }, [exportKey, season.id, season.name, slide, retry]);
  function saveImage() {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
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
            onClick={() => {
              setDirection(n > slide ? 1 : -1);
              setSlide(n);
            }}
          >
            <span className={n <= slide ? "seen" : ""} />
          </button>
        ))}
      </div>
      <header className="story-header">
        <span>
          Catan Chambers <b> / </b>
          {season.name.replace("Catan ", "S").replace(".0", "")}
        </span>
        <Link href="/" aria-label="Close season recap">
          <X size={21} />
        </Link>
      </header>
      <AnimatePresence mode="wait" initial={false}>
        <MotionPage className="story-body" key={slide} direction={direction}>
          {slide === 0 && (
            <>
              <p className="eyebrow">
                {season.status === "completed"
                  ? "Season champion"
                  : "Current leader"}
              </p>
              <h1>{winner.name}</h1>
              <div className="story-crown">
                <GameIcon name="crown" size={48} />
                <Avatar player={winner} large />
              </div>
              <div className="story-hero-number">
                <AnimatedNumber value={winner.total} />
                <span>Season points</span>
              </div>
              <div className="story-metrics">
                <div>
                  <strong>{winner.wins}</strong>
                  <span>Wins</span>
                </div>
                <div>
                  <strong>
                    {Math.round((winner.wins / winner.played) * 100)}%
                  </strong>
                  <span>Win rate</span>
                </div>
                <div>
                  <strong>+{winner.total - (rows[1]?.total || 0)}</strong>
                  <span>Winning margin</span>
                </div>
              </div>
              <p className="story-caption">
                {season.name} · {games.length} games
              </p>
            </>
          )}
          {slide === 1 && (
            <>
              <h1>Season highlights</h1>
              <div className="story-highlights">
                <div>
                  <GameIcon name="chalice" size={24} />
                  <span>
                    <small>Highest game score</small>
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
                  <GameIcon name="crown" size={24} />
                  <span>
                    <small>Longest win streak</small>
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
                  <GameIcon name="road" size={24} />
                  <span>
                    <small>Most Roads</small>
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
                  <GameIcon name="army" size={24} />
                  <span>
                    <small>Most Armies</small>
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
              <h1>Final standings</h1>
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
                <span>Prize pool</span>
                <strong>₹{season.prize_pool.toLocaleString("en-IN")}</strong>
              </div>
            </>
          )}
        </MotionPage>
      </AnimatePresence>
      <footer className="story-footer">
        <div className="story-controls">
          <button
            className="story-step"
            aria-label="Previous recap page"
            disabled={slide === 0}
            onClick={() => {
              setDirection(-1);
              setSlide((n) => n - 1);
            }}
          >
            <ChevronLeft size={23} />
          </button>
          <button
            className="story-save"
            disabled={busy || (!file && !exportError)}
            onClick={async () => {
              if (exportError) {
                setRetry((n) => n + 1);
                return;
              }
              if (!file) return;
              setError("");
              if (!canShareImage) {
                saveImage();
                return;
              }
              setBusy(true);
              try {
                await navigator.share({ files: [file] });
              } catch (error) {
                if (!(error instanceof Error && error.name === "AbortError"))
                  setError("Sharing is unavailable. Use Save image below.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {canShareImage ? (
              <Share2 size={17} />
            ) : (
              <ArrowDownToLine size={17} />
            )}
            {exportError
              ? "Retry image"
              : !file
                ? "Preparing image…"
                : busy
                  ? "Sharing…"
                  : canShareImage
                    ? "Share story"
                    : "Save image"}
          </button>
          <button
            className="story-step"
            aria-label="Next recap page"
            disabled={slide === 2}
            onClick={() => {
              setDirection(1);
              setSlide((n) => n + 1);
            }}
          >
            <ChevronRight size={23} />
          </button>
        </div>
        {canShareImage && (
          <button
            className="story-download"
            disabled={!file}
            onClick={saveImage}
          >
            Save image
          </button>
        )}
        {exportError && (
          <p role="alert" className="error-text">
            {exportError}
          </p>
        )}
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
      </footer>
    </main>
  );
}
