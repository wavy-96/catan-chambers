import { NextRequest, NextResponse } from "next/server";
import { COOKIE, verifySession, same } from "./lib/session";

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (
    path === "/login" ||
    path === "/api/session" ||
    path === "/api/keep-alive" ||
    path.startsWith("/_next/") ||
    path === "/icon.png"
  )
    return NextResponse.next();
  const role = await verifySession(req.cookies.get(COOKIE)?.value);
  const bot =
    process.env.BOT_API_TOKEN &&
    same(
      req.headers.get("authorization") || "",
      `Bearer ${process.env.BOT_API_TOKEN}`,
    );
  if (
    role ||
    (bot && ["/api/league", "/api/games", "/scorecard"].includes(path))
  ) {
    const res = NextResponse.next();
    res.headers.set("Cache-Control", "private, no-store");
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }
  if (path.startsWith("/api/"))
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  return NextResponse.redirect(new URL("/login", req.url));
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
