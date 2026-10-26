import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "momenti_kfl_session";
const SESSION_SECONDS = 60 * 60 * 8;

type SessionPayload = { user: string; exp: number };

function sessionSecret() {
  const secret = process.env.KFL_SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

function signature(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function sameSecret(left: string, right: string) {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

export function hasKflCredentials() {
  return Boolean(
    process.env.KFL_USERNAME &&
      process.env.KFL_PASSWORD &&
      sessionSecret()
  );
}

export function verifyKflCredentials(user: string, password: string) {
  const expectedUser = process.env.KFL_USERNAME;
  const expectedPassword = process.env.KFL_PASSWORD;
  if (!expectedUser || !expectedPassword || !sessionSecret()) return false;
  return sameSecret(user, expectedUser) && sameSecret(password, expectedPassword);
}

export function createKflSessionToken(user: string) {
  const secret = sessionSecret();
  if (!secret) throw new Error("KFL_SESSION_SECRET must contain at least 32 characters");
  const payload: SessionPayload = {
    user,
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return { token: `${encoded}.${signature(encoded, secret)}`, maxAge: SESSION_SECONDS };
}

function verifyKflSessionToken(token: string | undefined) {
  const secret = sessionSecret();
  if (!secret || !token) return false;
  const [payloadPart, receivedSignature, extra] = token.split(".");
  if (!payloadPart || !receivedSignature || extra) return false;
  if (!sameSecret(receivedSignature, signature(payloadPart, secret))) return false;

  try {
    const payload = JSON.parse(
      Buffer.from(payloadPart, "base64url").toString("utf8")
    ) as SessionPayload;
    return Boolean(
      payload.user &&
        Number.isFinite(payload.exp) &&
        payload.exp > Math.floor(Date.now() / 1000)
    );
  } catch {
    return false;
  }
}

export async function isKflAuthenticated() {
  const cookieStore = await cookies();
  return verifyKflSessionToken(cookieStore.get(COOKIE_NAME)?.value);
}

export const kflSessionCookie = COOKIE_NAME;
