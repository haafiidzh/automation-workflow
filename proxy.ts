import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, verifySignedSid } from "@/lib/auth";

/**
 * Page-level gate only. This is an optimistic check: it verifies the cookie
 * signature but does not load the session file, so a signed cookie whose
 * session was deleted still reaches the page — the API routes it then calls
 * answer 401 and the client redirects. Real authorization lives in each route
 * handler via requireUser(); nothing here is load-bearing for data access.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const raw = request.cookies.get(AUTH_COOKIE)?.value;

  let signedIn = false;
  try {
    signedIn = Boolean(raw && verifySignedSid(raw));
  } catch {
    // AUTH_SECRET missing — treat everyone as signed out rather than crashing
    // every page render; /login will surface the real error on submit.
    signedIn = false;
  }

  if (pathname === "/login") {
    return signedIn ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }

  if (!signedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // API routes guard themselves and must answer 401 rather than redirect, so
  // they are excluded here along with static assets.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
