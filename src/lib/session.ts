export const COOKIE = "chambers_session";
const encoder = new TextEncoder();
function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("Private access is not configured.");
  return value;
}
async function sign(message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return Array.from(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", key, encoder.encode(message)),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
export async function issueSession(role: "admin" | "viewer") {
  const value = `${Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30}.${role}`;
  return `${value}.${await sign(value)}`;
}
export async function verifySession(token?: string) {
  if (!token || !process.env.SESSION_SECRET) return null;
  const [expiry, role, signature, extra] = token.split(".");
  if (
    extra ||
    !expiry ||
    !signature ||
    !["admin", "viewer"].includes(role) ||
    Number(expiry) < Date.now() / 1000
  )
    return null;
  return same(signature, await sign(`${expiry}.${role}`))
    ? (role as "admin" | "viewer")
    : null;
}
