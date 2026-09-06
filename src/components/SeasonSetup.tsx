"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { GameIcon } from "./GameIcon";
import { MotionPage } from "./LeagueMotion";
import { League, Season, seasonRules, standings } from "@/lib/league";
import {
  validateSeasonSetup,
  RULE_METRICS,
  PLACE_CONTRIBUTIONS,
  PRIZE_POOL,
  type ScoringRule,
} from "@/lib/season-setup";
import { ContributionTable } from "./PrizePool";

export function PreviousSeasons({ data }: { data: League }) {
  const seasons = data.seasons.filter(
    (s) =>
      s.status === "completed" &&
      data.games.some((g) => g.tournament_id === s.id && !g.voided_at),
  );
  const [index, setIndex] = useState(0);
  const season = seasons[Math.min(index, seasons.length - 1)];
  if (!season) return <p>No completed seasons yet.</p>;
  const rows = standings(data.players, data.games, season);
  const champion = rows.filter((p) => p.rank === 1);
  const games = data.games.filter(
    (g) => g.tournament_id === season.id && !g.voided_at,
  );
  return (
    <section className="previous-seasons" aria-label="Previous seasons">
      <div className="previous-season-switch">
        <button
          type="button"
          className="icon-button"
          aria-label="More recent season"
          disabled={index === 0}
          onClick={() => setIndex((i) => i - 1)}
        >
          <ChevronLeft size={20} />
        </button>
        <span>
          {season.name.replace("Catan ", "Season ").replace(".0", "")}
        </span>
        <button
          type="button"
          className="icon-button"
          aria-label="Earlier season"
          disabled={index === seasons.length - 1}
          onClick={() => setIndex((i) => i + 1)}
        >
          <ChevronRight size={20} />
        </button>
      </div>
      <MotionPage key={season.id} className="previous-season-card">
        <GameIcon name="crown" size={58} />
        <h3>{champion.map((p) => p.name).join(" & ")}</h3>
        <p>
          {champion.length > 1 ? "Joint champions" : "Season champion"} ·{" "}
          {games.length} games
        </p>
        <div className="previous-season-points">
          <strong>{rows[0].total}</strong>
          <span>points</span>
        </div>
        <div className="previous-season-results">
          {rows.map((p) => (
            <div key={p.id}>
              <span>{p.rank}</span>
              <strong>{p.name}</strong>
              <span>{p.wins} wins</span>
              <b>{p.total}</b>
            </div>
          ))}
        </div>
        {seasonRules(season).note && (
          <p className="previous-season-note">{seasonRules(season).note}</p>
        )}
        <Link
          className="text-link"
          href={`/recap?season=${season.id}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${season.name} full recap in a new tab`}
        >
          Full recap <ChevronRight size={16} />
        </Link>
      </MotionPage>
    </section>
  );
}

export function SeasonRuleList({ season }: { season: Season }) {
  const rules = seasonRules(season);
  return (
    <div className="season-rule-list">
      <p>Game points count towards the season total.</p>
      {rules.bonuses.map((rule) => (
        <div key={rule.metric}>
          <span>{RULE_METRICS[rule.metric]}</span>
          <strong>+{rule.points}</strong>
        </div>
      ))}
      {!!rules.bonuses.length && (
        <p>
          {rules.tie === "each"
            ? "Tied leaders each receive the full bonus."
            : rules.tie === "split"
              ? "Tied leaders split the bonus equally."
              : rules.tie === "none"
                ? "Tied leaders receive no bonus."
                : "The bonus tiebreak rule is not recorded."}
        </p>
      )}
      {season.contributions && (
        <ContributionTable
          contributions={season.contributions}
          pool={season.prize_pool}
        />
      )}
    </div>
  );
}

export function SeasonOpeningDialog({
  data,
  season,
  close,
  record,
}: {
  data: League;
  season: Season;
  close: () => void;
  record: () => void;
}) {
  const [step, setStep] = useState(0);
  return (
    <Dialog open onOpenChange={close}>
      <DialogContent className="chamber-dialog season-setup-dialog">
        <DialogTitle>
          {step === 0 ? "Before game 1" : "Season rules"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Review past seasons and this season’s rules before recording the first
          game.
        </DialogDescription>
        {step === 0 ? (
          <PreviousSeasons data={data} />
        ) : (
          <SeasonRuleList season={season} />
        )}
        <div className="setup-actions">
          {step === 1 && (
            <button className="secondary-button" onClick={() => setStep(0)}>
              Back
            </button>
          )}
          <button
            className="primary-button"
            onClick={() => (step === 0 ? setStep(1) : record())}
          >
            {step === 0 ? "Season rules" : "Record game 1"}
            <ChevronRight size={18} />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function NewSeasonDialog({
  data,
  close,
  saved,
}: {
  data: League;
  close: () => void;
  saved: (id: string) => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const requestId = useRef(crypto.randomUUID());
  const latest = data.seasons[0];
  const nextSeason =
    Math.max(
      0,
      ...data.seasons.map((s) => Number(s.name.match(/\d+/)?.[0]) || 0),
    ) + 1;
  const [name, setName] = useState(`Catan ${nextSeason}.0`);
  const [count, setCount] = useState("20");
  const [scoringRules, setScoringRules] = useState<
    { metric: ScoringRule["metric"]; points: string }[]
  >(
    (latest
      ? seasonRules(latest).bonuses
      : [
          { metric: "roads" as const, points: 10 },
          { metric: "armies" as const, points: 10 },
        ]
    ).map((r) => ({ metric: r.metric, points: String(r.points) })),
  );
  const [tie, setTie] = useState(
    ["each", "split", "none"].includes(latest?.bonus_tie_rule || "")
      ? latest.bonus_tie_rule!
      : "",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const hasBonuses = scoringRules.length > 0;
  async function create() {
    setError("");
    try {
      if ([count, ...scoringRules.map((r) => r.points)].some((v) => !v.trim()))
        throw new Error("Fill in the season details and bonus points.");
      const setup = validateSeasonSetup({
        requestId: requestId.current,
        name,
        totalGames: Number(count),
        prizePool: PRIZE_POOL,
        contributions: [...PLACE_CONTRIBUTIONS],
        scoringRules: scoringRules.map((r) => ({
          metric: r.metric,
          points: Number(r.points),
        })),
        bonusTieRule: hasBonuses ? tie : "none",
      });
      setBusy(true);
      const response = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(setup),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Could not start the season.");
      await saved(result.seasonId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the season.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={() => {
        if (!busy) close();
      }}
    >
      <DialogContent className="chamber-dialog season-setup-dialog">
        <DialogTitle>
          {["Previous seasons", "New season", "Season rules"][step]}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Set up a season in three steps: recap, details, and rules.
        </DialogDescription>
        <ol className="setup-steps" aria-label="Season setup progress">
          {["Recap", "Details", "Rules"].map((label, i) => (
            <li key={label} aria-current={step === i ? "step" : undefined}>
              {label}
            </li>
          ))}
        </ol>
        {step === 0 && <PreviousSeasons data={data} />}
        {step === 1 && (
          <div className="setup-fields" onChangeCapture={() => setError("")}>
            <label htmlFor="season-name">Season name</label>
            <input
              id="season-name"
              maxLength={60}
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
                  onChange={(e) => setCount(e.target.value)}
                />
              </label>
            </div>
            <ContributionTable />
          </div>
        )}
        {step === 2 && (
          <div className="setup-fields" onChangeCapture={() => setError("")}>
            <p className="field-note">
              Award a season bonus to the leader in a recorded stat.
            </p>
            {scoringRules.map((rule, i) => (
              <div className="scoring-rule-input" key={i}>
                <label>
                  Stat
                  <select
                    aria-label={`Rule ${i + 1} stat`}
                    value={rule.metric}
                    onChange={(e) =>
                      setScoringRules((rs) =>
                        rs.map((r, n) =>
                          n === i
                            ? {
                                ...r,
                                metric: e.target.value as ScoringRule["metric"],
                              }
                            : r,
                        ),
                      )
                    }
                  >
                    {Object.entries(RULE_METRICS).map(([metric, label]) => (
                      <option
                        key={metric}
                        value={metric}
                        disabled={scoringRules.some(
                          (r, n) => n !== i && r.metric === metric,
                        )}
                      >
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="rule-points-row">
                  <label>
                    Bonus points
                    <input
                      aria-label={`Rule ${i + 1} bonus points`}
                      type="number"
                      min={1}
                      max={100}
                      value={rule.points}
                      onChange={(e) =>
                        setScoringRules((rs) =>
                          rs.map((r, n) =>
                            n === i ? { ...r, points: e.target.value } : r,
                          ),
                        )
                      }
                    />
                  </label>
                  <button
                    className="icon-button"
                    aria-label={`Remove rule ${i + 1}`}
                    onClick={() =>
                      setScoringRules((rs) => rs.filter((_, n) => n !== i))
                    }
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            ))}
            {scoringRules.length < Object.keys(RULE_METRICS).length && (
              <button
                className="secondary-button"
                onClick={() => {
                  const metric = (
                    Object.keys(RULE_METRICS) as ScoringRule["metric"][]
                  ).find((m) => !scoringRules.some((r) => r.metric === m))!;
                  setScoringRules((rs) => [...rs, { metric, points: "10" }]);
                }}
              >
                <Plus size={17} /> Add scoring rule
              </button>
            )}
            {!hasBonuses && (
              <p className="field-note">Game points only. No season bonuses.</p>
            )}
            {hasBonuses && (
              <>
                <label htmlFor="tie-rule">If bonus leaders tie</label>
                <select
                  id="tie-rule"
                  value={tie}
                  onChange={(e) => setTie(e.target.value)}
                >
                  <option value="" disabled>
                    Choose a rule
                  </option>
                  <option value="each">Full bonus for each player</option>
                  <option value="split">Split the bonus equally</option>
                  <option value="none">No bonus on a tie</option>
                </select>
              </>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        <div className="setup-actions">
          {step > 0 && (
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => {
                setError("");
                setStep((s) => s - 1);
              }}
            >
              Back
            </button>
          )}
          <button
            className="primary-button"
            disabled={busy}
            onClick={() => {
              setError("");
              if (step < 2) setStep((s) => s + 1);
              else void create();
            }}
          >
            {busy
              ? "Starting…"
              : step === 0
                ? "Set up season"
                : step === 1
                  ? "Choose rules"
                  : "Start season"}
            <ChevronRight size={18} />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
