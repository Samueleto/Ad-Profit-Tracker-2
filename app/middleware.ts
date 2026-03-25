import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Placeholder middleware — onboarding redirect logic will be added here in a later step
export function middleware(request: NextRequest) {
  // TODO: Add onboarding redirect logic (step 300)
  // TODO: Add auth protection for protected routes (step 287)
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
     * - API routes (handled separately)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
