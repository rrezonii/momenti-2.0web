import { NextResponse } from "next/server";
import {
  createKflSessionToken,
  hasKflCredentials,
  kflSessionCookie,
  verifyKflCredentials,
} from "@/lib/kfl/auth";
import { isSameOriginRequest } from "@/lib/kfl/origin";

export const runtime = "nodejs";

const attempts = new Map<string, { count: number; expiresAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

function isThrottled(key: string) {
  const entry = attempts.get(key);
  if (!entry || entry.expiresAt <= Date.now()) return false;
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(key: string) {
  const now = Date.now();
  if (attempts.size > 500) {
    for (const [candidate, value] of attempts) {
      if (value.expiresAt <= now) attempts.delete(candidate);
    }
  }
  const current = attempts.get(key);
  attempts.set(key, current && current.expiresAt > now
    ? { ...current, count: current.count + 1 }
    : { count: 1, expiresAt: now + WINDOW_MS });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Kërkesë e pavlefshme" }, { status: 403 });
  }

  if (!hasKflCredentials()) {
    return NextResponse.json(
      { error: "Hyrja KFL nuk është konfiguruar në server." },
      { status: 503 }
    );
  }

  const key = clientKey(request);
  if (isThrottled(key)) {
    return NextResponse.json({ error: "Shumë tentativa. Provo përsëri pas 15 minutash." }, { status: 429 });
  }

  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Të dhënat nuk janë të vlefshme." }, { status: 400 });
  }

  if (
    typeof body.username !== "string" ||
    typeof body.password !== "string" ||
    body.username.length > 256 || body.password.length > 256 ||
    !verifyKflCredentials(body.username, body.password)
  ) {
    recordFailure(key);
    return NextResponse.json({ error: "Emri i përdoruesit ose fjalëkalimi është i pasaktë." }, { status: 401 });
  }

  attempts.delete(key);
  const { token, maxAge } = createKflSessionToken(body.username);
  const response = NextResponse.json({ success: true });
  response.cookies.set(kflSessionCookie, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/kycu",
    maxAge,
  });
  return response;
}
