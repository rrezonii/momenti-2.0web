import { createHmac, timingSafeEqual } from "node:crypto";

// Login for the newsroom portal (redaksia.momenti.info). A signed, HttpOnly cookie keeps the
// session for 10 minutes; every request while logged in renews it (so it ends after 10 idle minutes).
// Changing the password (env REDAKSIA_PASSWORD) logs everyone out.
export const SESSION_COOKIE = "redaksia_session";
const USER = process.env.REDAKSIA_USER?.trim() || "redaksia";
const PASSWORDS = (process.env.REDAKSIA_PASSWORD?.trim() || "Rrezoni2026").split(",").map((value) => value.trim()).filter(Boolean);
const SECRET = process.env.REDAKSIA_SECRET?.trim() || `momenti-redaksia:${USER}:${PASSWORDS.join(",")}`;
const MAX_AGE = 10 * 60; // 10 minutes without activity, then log in again

function same(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

const sign = (value: string) => createHmac("sha256", SECRET).update(value).digest("base64url");

export function checkLogin(username: string, password: string) {
  const user = username.trim().toLowerCase();
  // The password is accepted with or without a trailing full stop ("Rrezoni2026" / "Rrezoni2026.").
  const pass = password.trim().replace(/\.$/, "");
  return same(user, USER.toLowerCase()) && PASSWORDS.some((candidate) => same(pass, candidate.replace(/\.$/, "")));
}

export function sessionCookie() {
  const expires = Math.floor(Date.now() / 1000) + MAX_AGE;
  const value = `${expires}.${sign(String(expires))}`;
  return `${SESSION_COOKIE}=${value}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`;
}

export const clearSessionCookie = () => `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;

export function hasSession(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (!match) return false;
  const [expires, signature] = match[1].split(".");
  if (!expires || !signature || Number(expires) * 1000 < Date.now()) return false;
  return same(signature, sign(expires));
}

export const isRedaksiaHost = (request: Request) => (request.headers.get("host") ?? "").toLowerCase().startsWith("redaksia.");

// Not logged in on the portal host: send the page to the login screen (API calls get 401).
export function loginRedirect(request: Request) {
  const url = new URL(request.url);
  const next = url.pathname;
  return new Response(null, { status: 303, headers: { Location: `/?next=${encodeURIComponent(next)}`, "Cache-Control": "no-store" } });
}

// Wrap a route handler: while the session is valid, each response renews the 10-minute cookie.
export function renewing(handler: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    const response = await handler(request);
    if (!hasSession(request)) return response;
    const headers = new Headers(response.headers);
    if (!headers.has("Set-Cookie")) headers.append("Set-Cookie", sessionCookie());
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  };
}
