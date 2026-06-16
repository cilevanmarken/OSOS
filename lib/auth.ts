// Shared-password gate. One password (env var APP_PASSWORD) protects the whole
// app; volunteers type it once and get an httpOnly session cookie. Used by both
// the Edge middleware and the /api/login route, so everything here relies only
// on Web Crypto (globalThis.crypto.subtle) — no Node-only APIs.

export const COOKIE_NAME = "osos_session";

// The session token is an HMAC of a constant message, keyed by the shared
// password. It is stable for a given password and changes the moment the
// password is rotated — which invalidates every existing session.
const SESSION_MESSAGE = "osos-auth-v1";

async function hmacHex(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Constant-time-ish string compare to avoid leaking how much of the value
// matched via response timing.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isConfigured(): boolean {
  return !!process.env.APP_PASSWORD;
}

export async function sessionToken(): Promise<string | null> {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return null;
  return hmacHex(SESSION_MESSAGE, pw);
}

export async function verifyPassword(input: string): Promise<boolean> {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return false;
  return safeEqual(input, pw);
}

export async function isValidSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const expected = await sessionToken();
  if (!expected) return false;
  return safeEqual(token, expected);
}
