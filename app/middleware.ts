import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Cookie names
const OB_DONE_COOKIE = "ob_done";
// __session is set client-side when the user authenticates, providing a
// server-side signal that the browser has an active Firebase session.
const SESSION_COOKIE = "__session";

// Routes that require onboarding to be complete
const PROTECTED_ROUTES = ["/dashboard", "/settings", "/reports", "/team", "/help", "/reconciliation"];
const ONBOARDING_PATH = "/onboarding";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip API routes and static assets
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const obDone = request.cookies.get(OB_DONE_COOKIE)?.value === "1";
  const hasSession = !!request.cookies.get(SESSION_COOKIE)?.value;

  // If authenticated user who has completed onboarding visits /onboarding, redirect to /dashboard
  if (pathname.startsWith(ONBOARDING_PATH) && obDone) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // /onboarding requires an active Firebase session — redirect to login if absent.
  // This check runs server-side and cannot be bypassed by disabling JavaScript.
  if (pathname.startsWith(ONBOARDING_PATH) && !hasSession) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Protected routes require both an active Firebase session and completed onboarding.
  // Redirect to / (sign-in page) if either is absent.
  const isProtected = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
  if (isProtected && !hasSession) {
    const loginUrl = new URL("/", request.url);
    loginUrl.searchParams.set("returnUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }
  if (isProtected && !obDone) {
    const loginUrl = new URL("/", request.url);
    loginUrl.searchParams.set("returnUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
