import crypto from "crypto";
import fs from "fs";
import path from "path";

const WORKFLOW_DIR = path.join(process.cwd(), "workflow");
const AUTH_SESSIONS_DIR = path.join(WORKFLOW_DIR, "auth-sessions");

/** 30 days, in milliseconds. Also used as the cookie maxAge (in seconds). */
export const AUTH_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** A sid is exactly 32 random bytes rendered as hex — nothing else is valid. */
const SID_RE = /^[a-f0-9]{64}$/;

export type AuthSession = {
  userId: string;
  createdAt: string;
  lastSeenAt: string;
  userAgent: string;
};

/**
 * Rejects anything that is not a well-formed sid before it reaches the
 * filesystem, so a crafted cookie cannot walk out of the sessions directory.
 */
function sessionFilePath(sid: string): string {
  if (!SID_RE.test(sid)) {
    throw new Error("Invalid auth session id");
  }
  return path.join(AUTH_SESSIONS_DIR, `${sid}.json`);
}

export function isValidSid(sid: string): boolean {
  return SID_RE.test(sid);
}

export function createAuthSession(userId: string, userAgent: string): string {
  fs.mkdirSync(AUTH_SESSIONS_DIR, { recursive: true });
  const sid = crypto.randomBytes(32).toString("hex");
  const now = new Date().toISOString();
  const session: AuthSession = {
    userId,
    createdAt: now,
    lastSeenAt: now,
    userAgent: userAgent.slice(0, 256),
  };
  fs.writeFileSync(sessionFilePath(sid), JSON.stringify(session, null, 2));
  return sid;
}

/** Returns null for unknown, unreadable, or expired sessions; expired files are deleted. */
export function readAuthSession(sid: string): AuthSession | null {
  const filePath = sessionFilePath(sid);
  if (!fs.existsSync(filePath)) return null;

  let session: AuthSession;
  try {
    session = JSON.parse(fs.readFileSync(filePath, "utf-8")) as AuthSession;
  } catch {
    return null;
  }

  const createdAt = Date.parse(session.createdAt);
  if (!Number.isFinite(createdAt) || Date.now() - createdAt > AUTH_SESSION_TTL_MS) {
    deleteAuthSession(sid);
    return null;
  }

  return session;
}

export function touchAuthSession(sid: string): void {
  const filePath = sessionFilePath(sid);
  if (!fs.existsSync(filePath)) return;
  try {
    const session = JSON.parse(fs.readFileSync(filePath, "utf-8")) as AuthSession;
    session.lastSeenAt = new Date().toISOString();
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
  } catch {
    // A corrupt session file is treated as gone by readAuthSession; nothing to touch.
  }
}

/** Idempotent: deleting an already-deleted session is not an error. */
export function deleteAuthSession(sid: string): void {
  let filePath: string;
  try {
    filePath = sessionFilePath(sid);
  } catch {
    return;
  }
  try {
    fs.unlinkSync(filePath);
  } catch {
    // already gone
  }
}
