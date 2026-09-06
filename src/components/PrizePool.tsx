import { Season, seasonPayout, standings } from "@/lib/league";
import { PLACE_CONTRIBUTIONS, PRIZE_POOL } from "@/lib/season-setup";
const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;
export function ContributionTable({
  contributions = PLACE_CONTRIBUTIONS,
  pool = PRIZE_POOL,
}: {
  contributions?: readonly number[];
  pool?: number;
}) {
  return (
    <div className="prize-plan">
      <div className="prize-plan-heading">
        <h3>Winner takes the pool</h3>
        <strong>{money(pool)}</strong>
      </div>
      <table>
        <thead>
          <tr>
            <th>Finish</th>
            <th>Pays</th>
          </tr>
        </thead>
        <tbody>
          {contributions.map((amount, i) => (
            <tr key={i}>
              <td>{["1st", "2nd", "3rd", "4th"][i]}</td>
              <td>{money(amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>1st place pays ₹0 and receives {money(pool)}.</p>
    </div>
  );
}
export function PrizePool({
  season,
  rows,
}: {
  season: Season;
  rows: ReturnType<typeof standings>;
}) {
  const payout = seasonPayout(season, rows);
  if (!payout) return null;
  return (
    <section className="season-payout">
      <h2>Prize pool</h2>
      <ContributionTable
        contributions={season.contributions!}
        pool={season.prize_pool}
      />
      {payout.pending ? (
        <p className="field-note">
          {rows.every((p) => !p.played)
            ? payout.final
              ? "No games recorded. No player payout assigned."
              : "Player contributions appear after the first game."
            : "Final-place ties must be resolved before contributions and payout are assigned."}
        </p>
      ) : (
        <>
          <h3>
            {payout.final ? "Final contributions" : "At current standings"}
          </h3>
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>Pays</th>
              </tr>
            </thead>
            <tbody>
              {payout.rows.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{money(p.pays!)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            {payout.winner} {payout.final ? "receives" : "would receive"}{" "}
            {money(season.prize_pool)}.
          </p>
        </>
      )}
    </section>
  );
}
