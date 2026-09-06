import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { NextRequest, NextResponse } from "next/server";
import { currentRole, loadLeague } from "@/lib/server";
import { standings, seasonRules, COLORS } from "@/lib/league";
// Keep the exported artwork identical to the app without network font requests.
const assets = Promise.all([
  readFile(join(process.cwd(), "src/assets/fonts/Macondo-Regular.ttf")),
  readFile(join(process.cwd(), "src/assets/fonts/CrimsonPro-Regular.ttf")),
  readFile(join(process.cwd(), "src/assets/fonts/CrimsonPro-Semibold.ttf")),
  readFile(join(process.cwd(), "public/colonist.png")),
  readFile(join(process.cwd(), "public/icon-crown.png")),
]);
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  if (!(await currentRole()))
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const data = await loadLeague(),
    season = data.seasons.find(
      (s) => s.id === req.nextUrl.searchParams.get("season"),
    );
  if (!season)
    return NextResponse.json({ error: "Season not found." }, { status: 404 });
  const slide = Number(req.nextUrl.searchParams.get("slide") || 0);
  if (![0, 1, 2].includes(slide))
    return NextResponse.json({ error: "Unknown recap page." }, { status: 400 });
  const rows = standings(data.players, data.games, season),
    winner = rows[0],
    games = data.games.filter(
      (g) => g.tournament_id === season.id && !g.voided_at,
    );
  if (!winner || !games.length)
    return NextResponse.json({ error: "No games to recap." }, { status: 400 });
  const biggest = Math.max(
    ...games.flatMap((g) => g.game_scores.map((s) => s.points)),
  );
  const awards = [
    {
      label: "Highest game score",
      value: `${biggest} points`,
      names: [
        ...new Set(
          games.flatMap((g) =>
            g.game_scores
              .filter((s) => s.points === biggest)
              .map((s) => data.players.find((p) => p.id === s.player_id)?.name),
          ),
        ),
      ].join(" & "),
    },
    ...(
      [
        {
          field: "bestStreak",
          label: "Longest win streak",
          suffix: "wins in a row",
        },
        { field: "roads", label: "Most Roads", suffix: "Longest Roads" },
        { field: "armies", label: "Most Armies", suffix: "Largest Armies" },
      ] as const
    ).map((a) => {
      const max = Math.max(...rows.map((p) => p[a.field]));
      return {
        label: a.label,
        value: `${max} ${a.suffix}`,
        names: rows
          .filter((p) => p[a.field] === max)
          .map((p) => p.name)
          .join(" & "),
      };
    }),
  ];
  const title =
    slide === 0
      ? `${winner.name}`
      : slide === 1
        ? "Season highlights"
        : "Final standings";
  const theme =
    slide === 2
      ? {
          bg: "#263041",
          ink: "#fff8e9",
          accent: "#f4c776",
          muted: "#c3c4c8",
          line: "#515866",
        }
      : slide === 1
        ? {
            bg: "#f5c76f",
            ink: "#513313",
            accent: "#8a4c09",
            muted: "#80551c",
            line: "#ccaa69",
          }
        : {
            bg: "#fcf9f2",
            ink: "#263041",
            accent: "#a86108",
            muted: "#657083",
            line: "#e1d6c4",
          };
  const [macondo, crimson, crimsonBold, colonist, crown] = await assets;
  const fontData = (buffer: Buffer) =>
    buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer;
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: theme.bg,
        color: theme.ink,
        padding: "90px 80px",
        fontFamily: "Crimson",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 27,
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            fontFamily: "Macondo",
            fontSize: 36,
          }}
        >
          {/* ImageResponse renders an img directly into the PNG. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/png;base64,${colonist.toString("base64")}`}
            width={76}
            height={76}
            alt=""
          />
          Catan Chambers
        </div>
        <span>{season.name}</span>
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 104,
          fontWeight: 600,
          lineHeight: 1.05,
          fontFamily: "Macondo",
          letterSpacing: 0,
          marginTop: 115,
          marginBottom: 75,
          maxWidth: 880,
        }}
      >
        {title}
      </div>
      {slide === 0 && (
        <div
          style={{ display: "flex", flexDirection: "column", width: "100%" }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 285,
              fontFamily: "Macondo",
              letterSpacing: -4,
              fontWeight: 600,
              color: theme.accent,
              lineHeight: 1,
            }}
          >
            {winner.total}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/png;base64,${crown.toString("base64")}`}
              width={140}
              height={140}
              alt=""
              style={{ marginLeft: 36, marginTop: 50 }}
            />
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 28,

              color: theme.muted,
              marginTop: 20,
            }}
          >
            Season points
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              borderTop: `2px solid ${theme.line}`,
              borderBottom: `2px solid ${theme.line}`,
              padding: "50px 0",
              marginTop: 80,
            }}
          >
            {[
              { n: winner.wins, label: "Wins" },
              {
                n: `${Math.round((winner.wins / winner.played) * 100)}%`,
                label: "Win rate",
              },
              {
                n: `+${winner.total - (rows[1]?.total || 0)}`,
                label: "Margin",
              },
            ].map((v) => (
              <div
                key={v.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <b style={{ fontSize: 70 }}>{v.n}</b>
                <span style={{ fontSize: 23, marginTop: 12 }}>{v.label}</span>
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 40,
              lineHeight: 1.5,
              marginTop: 80,
            }}
          >
            Season champion · {games.length} games
          </div>
        </div>
      )}
      {slide === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 35 }}>
          {awards.map((a) => (
            <div
              key={a.label}
              style={{
                display: "flex",
                flexDirection: "column",
                borderBottom: `2px solid ${theme.line}`,
                paddingBottom: 35,
              }}
            >
              <span style={{ display: "flex", fontSize: 30 }}>{a.label}</span>
              <b style={{ display: "flex", fontSize: 58, marginTop: 15 }}>
                {a.value}
              </b>
              <span style={{ display: "flex", fontSize: 33, marginTop: 12 }}>
                {a.names}
              </span>
            </div>
          ))}
        </div>
      )}
      {slide === 2 && (
        <div
          style={{ display: "flex", flexDirection: "column", width: "100%" }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            {rows.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  borderBottom: `2px solid ${theme.line}`,
                  padding: "35px 0",
                  gap: 30,
                }}
              >
                <span style={{ fontSize: 32, color: theme.muted }}>
                  {p.rank}
                </span>
                <span
                  style={{
                    display: "flex",
                    width: 80,
                    height: 80,
                    background: COLORS[p.name] || theme.accent,
                    color: "#ffffff",
                    borderRadius: 24,
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 44,
                    fontWeight: 600,
                  }}
                >
                  {p.name[0]}
                </span>
                <strong style={{ display: "flex", flex: 1, fontSize: 45 }}>
                  {p.name}
                </strong>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                  }}
                >
                  <b style={{ fontSize: 62 }}>{p.total}</b>
                  <small style={{ fontSize: 23, color: theme.muted }}>
                    {p.bonus ? `${p.points} + ${p.bonus} bonus` : "points"}
                  </small>
                </div>
              </div>
            ))}
          </div>
          {seasonRules(season).note && (
            <div
              style={{
                display: "flex",
                marginTop: 50,
                padding: 30,
                border: `2px dashed ${theme.line}`,
                fontSize: 33,
                lineHeight: 1.4,
              }}
            >
              {seasonRules(season).note}
            </div>
          )}
          <div
            style={{
              display: "flex",
              marginTop: 55,
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 29,
            }}
          >
            <span>Prize pool</span>
            <b style={{ fontSize: 58 }}>
              INR {season.prize_pool.toLocaleString("en-IN")}
            </b>
          </div>
        </div>
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: "auto",
          fontSize: 24,
        }}
      >
        <span>0{slide + 1} / 03</span>
      </div>
    </div>,
    {
      width: 1080,
      height: 1920,
      fonts: [
        {
          name: "Macondo",
          data: fontData(macondo),
          weight: 400,
          style: "normal",
        },
        {
          name: "Crimson",
          data: fontData(crimson),
          weight: 400,
          style: "normal",
        },
        {
          name: "Crimson",
          data: fontData(crimsonBold),
          weight: 600,
          style: "normal",
        },
      ],
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="chambers-recap-${slide + 1}.png"`,
      },
    },
  );
}
