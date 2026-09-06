import Image from "next/image";
import colonist from "../../public/colonist.png";
import leaderboard from "../../public/icon-leaderboard.png";
import stats from "../../public/icon-stats.png";
import history from "../../public/icon-history.png";
import balance from "../../public/icon-balance.png";
import trend from "../../public/icon-trend.png";
import road from "../../public/icon-road.png";
import army from "../../public/icon-army.png";
import crown from "../../public/icon-crown.png";
import chalice from "../../public/icon-chalice.png";
import shackles from "../../public/icon-shackles.png";

const artwork = {
  colonist,
  leaderboard,
  stats,
  history,
  balance,
  trend,
  road,
  army,
  crown,
  chalice,
  shackles,
};
export function GameIcon({
  name,
  size = 28,
  className = "",
}: {
  name: keyof typeof artwork;
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src={artwork[name]}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={`game-icon ${className}`}
      style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }}
    />
  );
}
