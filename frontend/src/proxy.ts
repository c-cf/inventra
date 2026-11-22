import { type NextRequest, NextResponse } from "next/server";

/** Set (httpOnly) by the API on login; see backend/app/security.py. */
const SESSION_COOKIE = "inventra_session";

/**
 * Sends visitors without a session cookie to /login before a protected page
 * renders. The cookie is only checked for presence here; the API still
 * validates it on every request, and an expired one surfaces as a 401 there.
 *
 * This works because the browser sends the API's cookie to the UI too: cookies
 * are scoped by host, not port, so localhost:8000's cookie reaches localhost:3000.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/products/:path*", "/orders/:path*", "/users/:path*", "/account/:path*"],
};
