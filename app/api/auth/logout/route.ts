import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE, currentSid } from "@/lib/auth";
import { deleteAuthSession } from "@/lib/auth-sessions";

/** Idempotent: logging out twice, or without a session, still returns 200. */
export async function POST() {
  const sid = await currentSid();
  if (sid) deleteAuthSession(sid);
  (await cookies()).delete(AUTH_COOKIE);
  return NextResponse.json({ ok: true });
}
