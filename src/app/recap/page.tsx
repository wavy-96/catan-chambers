import { redirect, notFound } from "next/navigation";
import SeasonStory from "@/components/SeasonStory";
import { currentRole, loadLeague } from "@/lib/server";
export const dynamic = "force-dynamic";
export default async function Recap({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const role = await currentRole();
  if (!role) redirect("/login");
  const data = await loadLeague(),
    query = await searchParams;
  const season =
    data.seasons.find((s) => s.id === query.season) ||
    (!query.season ? data.seasons.find((s) => s.status === "completed") : null);
  if (!season) notFound();
  return <SeasonStory data={{ ...data, role }} season={season} />;
}
