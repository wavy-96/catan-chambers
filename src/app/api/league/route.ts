import { NextResponse } from "next/server";
import { currentRole, loadLeague } from "@/lib/server";
export const dynamic = "force-dynamic";
export async function GET() {
  const role = await currentRole(true);
  if (!role)
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  try {
    return NextResponse.json(
      { ...(await loadLeague()), role },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Could not load the league. Try again." },
      { status: 503 },
    );
  }
}
