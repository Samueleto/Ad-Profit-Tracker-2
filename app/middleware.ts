import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Cookie name used to track onboarding completion
const OB_DONE_COOKIE = "ob_done";

// Routes that require onboarding to be complete
const PROTECTED_ROUTES = ["/dashboard", "/settings", "/reports", "/team", "/help"];
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

  // If authenticated user who has completed onboarding visits /onboarding, send them to /dashboard
  if (pathname.startsWith(ONBOARDING_PATH) && obDone) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // If user visits a protected route without the onboarding-done cookie, redirect to /onboarding
  const isProtected = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
  if (isProtected && !obDone) {
    return NextResponse.redirect(new URL(ONBOARDING_PATH, request.url));
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
