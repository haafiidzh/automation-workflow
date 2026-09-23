import crypto from "crypto";
import { cookies } from "next/headers";
import {
  AUTH_SESSION_TTL_MS,
  deleteAuthSession,
  isValidSid,
  readAuthSession,
  touchAuthSession,
} from "./auth-sessions";
import { getUserById, type User } from "./users";

export const AUTH_COOKIE = "orch_session";
export const AUTH_COOKIE_MAX_AGE = Math.floor(AUTH_SESSION_TTL_MS / 1000);

/**
 * There is no default secret on purpose: an unsigned or predictably-signed
 * cookie is the whole credential in this username-only setup. Resolved lazily
 * so the error surfaces as a readable runtime failure rather than a build crash.
 */
function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET is missing or shorter than 32 characters — generate one with `openssl rand -hex 32`"
    );
  }
  return secret;
}

function hmac(sid: string): string {
  return crypto.createHmac("sha256", getAuthSecret()).update(sid).digest("hex");
}

export function signSid(sid: string): string {
  return `${sid}.${hmac(sid)}`;
}

/** Returns the sid only when the signature verifies; null otherwise. */
export function verifySignedSid(value: string): string | null {
  const dot = value.indexOf(".");
  if (dot === -1) return null;
  const sid = value.slice(0, dot);
  const given = value.slice(dot + 1);
  if (!isValidSid(sid)) return null;

  const expected = hmac(sid);
  // Lengths are fixed hex digests, but guard anyway: timingSafeEqual throws on
  // a length mismatch instead of returning false.
  if (given.length !== expected.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(given, "hex"), Buffer.from(expected, "hex"))) {
      return null;
    }
  } catch {
    return null;
  }
  return sid;
}

export type CurrentUser = Pick<User, "id" | "username" | "label">;

/** Null on every failure path: no cookie, bad signature, dead session, unknown user. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const raw = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!raw) return null;

  const sid = verifySignedSid(raw);
  if (!sid) return null;

  const session = readAuthSession(sid);
  if (!session) return null;

  const user = getUserById(session.userId);
  if (!user) {
    // The user was removed from users.json while logged in — drop the session.
    deleteAuthSession(sid);
    return null;
  }

  touchAuthSession(sid);
  return { id: user.id, username: user.username, label: user.label };
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

/** Throws UnauthorizedError; callers map it to a 401 response. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

/** Reads the signed sid without loading the session — used by logout. */
export async function currentSid(): Promise<string | null> {
  const raw = (await cookies()).get(AUTH_COOKIE)?.value;
  return raw ? verifySignedSid(raw) : null;
}

export function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "Belum login" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
