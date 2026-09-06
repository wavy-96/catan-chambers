import { redirect, notFound } from "next/navigation";
import { currentRole, loadLeague } from "@/lib/server";
import { standings, seasonRules } from "@/lib/league";
export const dynamic = "force-dynamic";
export default async function Scorecard({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  if (!(await currentRole(true))) redirect("/login");
  const data = await loadLeague(),
    query = await searchParams;
  const season =
    data.seasons.find((s) => s.id === query.season) ||
    (!query.season ? data.seasons[0] : null);
  if (!season) notFound();
  const rows = standings(data.players, data.games, season),
    played = data.games.filter(
      (g) => g.tournament_id === season.id && !g.voided_at,
    ).length;
  return (
    <main className="scorecard-export" id="scorecard">
      <p className="eyebrow">CATAN CHAMBERS</p>
      <h1>
        {season.name}
        <em>
          {season.status === "completed"
            ? "Final standings."
            : "The race is on."}
        </em>
      </h1>
      <p>
        {played} games · ₹{season.prize_pool.toLocaleString("en-IN")} on the
        line
      </p>
      {rows.map((p) => (
        <div className="export-row" key={p.id}>
          <span>{p.rank}</span>
          <div>
            <strong>{p.name}</strong>
            <small>
              {p.wins} wins · {p.roads} roads · {p.armies} armies
            </small>
          </div>
          <b>
            {p.total}
            <small>{p.bonus ? `+${p.bonus} bonus` : "points"}</small>
          </b>
        </div>
      ))}
      {seasonRules(season).note && (
        <p className="forfeit-note">{seasonRules(season).note}</p>
      )}
      <footer>THE INNER CIRCLE · EVERY POINT COUNTS</footer>
    </main>
  );
}
