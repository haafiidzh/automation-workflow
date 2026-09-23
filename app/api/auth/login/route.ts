import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE, AUTH_COOKIE_MAX_AGE, signSid } from "@/lib/auth";
import { createAuthSession } from "@/lib/auth-sessions";
import { getUserByUsername } from "@/lib/users";

type LoginBody = { username?: string };

export async function POST(req: NextRequest) {
  let body: LoginBody;
  try {
    body = (await req.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: "Body harus JSON" }, { status: 400 });
  }

  const username = (body.username ?? "").trim();
  if (!username) {
    return NextResponse.json({ error: "username wajib diisi" }, { status: 400 });
  }

  const user = getUserByUsername(username);
  // Same generic message for every rejection so the endpoint cannot be used to
  // enumerate which usernames exist.
  if (!user) {
    return NextResponse.json({ error: "username tidak dikenal" }, { status: 401 });
  }

  // A user who already has a password must not be able to log in through the
  // username-only path — otherwise adding passwords later silently does nothing.
  if (user.passwordHash !== null) {
    return NextResponse.json(
      { error: "Login berpassword belum didukung" },
      { status: 501 }
    );
  }

  const sid = createAuthSession(user.id, req.headers.get("user-agent") ?? "");

  (await cookies()).set(AUTH_COOKIE, signSid(sid), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE,
    secure: req.nextUrl.protocol === "https:",
  });

  return NextResponse.json({ id: user.id, username: user.username, label: user.label });
}
