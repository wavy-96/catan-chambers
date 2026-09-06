import { createClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { COOKIE, verifySession, same } from "./session";
import type { League } from "./league";

export function database() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  )
    throw new Error("Database is not configured.");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function currentRole(allowBot = false) {
  if (
    allowBot &&
    process.env.BOT_API_TOKEN &&
    same(
      (await headers()).get("authorization") || "",
      `Bearer ${process.env.BOT_API_TOKEN}`,
    )
  )
    return "admin";
  return verifySession((await cookies()).get(COOKIE)?.value);
}
export async function loadLeague(): Promise<Omit<League, "role">> {
  const db = database();
  const [players, seasons, games] = await Promise.all([
    db.from("players").select("id,name,avatar_url").order("name"),
    db
      .from("tournaments")
      .select("*")
      .order("created_at", { ascending: false })
      .order("name", { ascending: false }),
    db
      .from("games")
      .select("*,game_scores(player_id,points,longest_road,largest_army)")
      .order("game_number"),
  ]);
  for (const r of [players, seasons, games])
    if (r.error) throw new Error("Could not load league data. Please retry.");
  return { players: players.data!, seasons: seasons.data!, games: games.data! };
}
