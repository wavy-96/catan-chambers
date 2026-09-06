import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { COOKIE, issueSession, same } from "@/lib/session";
import { database } from "@/lib/server";
export async function POST(req: NextRequest) {
  if (req.headers.get("origin") !== req.nextUrl.origin)
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  if (!process.env.SESSION_SECRET)
    return NextResponse.json(
      { error: "Private access is not configured yet." },
      { status: 503 },
    );
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "local";
  const key = createHmac("sha256", process.env.SESSION_SECRET)
    .update(ip)
    .digest("hex");
  const { data: allowed, error: limiterError } = await database().rpc(
    "chambers_login_allowed",
    { p_key: key },
  );
  if (limiterError)
    return NextResponse.json(
      { error: "Private access is being set up. Please try again shortly." },
      { status: 503 },
    );
  if (!allowed)
    return NextResponse.json(
      { error: "Too many attempts. Try again in 15 minutes." },
      { status: 429 },
    );
  try {
    const { password } = await req.json();
    if (typeof password !== "string" || password.length > 200)
      throw new Error("Invalid passcode.");
    const role =
      process.env.ADMIN_PASSWORD && same(password, process.env.ADMIN_PASSWORD)
        ? "admin"
        : process.env.GROUP_PASSWORD &&
            same(password, process.env.GROUP_PASSWORD)
          ? "viewer"
          : null;
    if (!role)
      return NextResponse.json(
        { error: "That passcode did not match. Try again." },
        { status: 401 },
      );
    const response = NextResponse.json({ role });
    response.cookies.set(COOKIE, await issueSession(role), {
      httpOnly: true,
      secure: req.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Could not sign in." }, { status: 400 });
  }
}
export async function DELETE(req: NextRequest) {
  if (req.headers.get("origin") !== req.nextUrl.origin)
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(COOKIE);
  return response;
}
