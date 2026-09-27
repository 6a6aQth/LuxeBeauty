import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { processAuthMiddleware } from "@neondatabase/auth/server";

const SESSION_VERIFIER = "neon_auth_session_verifier";

/**
 * Google returns to the site with a one-time verifier. Neon only turns that
 * into a session cookie inside middleware. Without this, /auth/continue sees
 * no session and sends the customer back to sign-in.
 * An empty skip route matches every path, so this does not lock public pages.
 */
export async function middleware(request: NextRequest) {
  if (!request.nextUrl.searchParams.has(SESSION_VERIFIER)) {
    return NextResponse.next();
  }

  const baseUrl = process.env.NEON_AUTH_BASE_URL?.trim();
  const secret = process.env.NEON_AUTH_COOKIE_SECRET?.trim();
  const configured =
    Boolean(baseUrl?.includes("neonauth")) &&
    !baseUrl?.includes("ep-xxx") &&
    Boolean(secret && secret.length >= 32);
  if (!configured || !baseUrl || !secret) {
    return NextResponse.next();
  }

  const result = await processAuthMiddleware({
    request,
    pathname: request.nextUrl.pathname,
    skipRoutes: [""],
    loginUrl: "/auth/sign-in",
    baseUrl,
    cookieSecret: secret,
  });

  if (result.action !== "redirect_oauth") {
    return NextResponse.next();
  }

  const headers = new Headers();
  for (const cookie of result.cookies) headers.append("Set-Cookie", cookie);
  return NextResponse.redirect(result.redirectUrl, { headers });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
