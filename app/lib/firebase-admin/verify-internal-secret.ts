import { NextResponse } from "next/server";

/**
 * Verifies that the request carries a valid x-internal-secret header.
 * Used exclusively by internal endpoints called by Cloud Scheduler.
 * Returns null on success; returns a 401 NextResponse on failure.
 */
export function verifyInternalSecret(
  request: Request
): NextResponse | null {
  const secret = process.env.INTERNAL_SYNC_SECRET;
  if (!secret) {
    console.error("INTERNAL_SYNC_SECRET is not configured");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const provided = request.headers.get("x-internal-secret");
  if (!provided || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Block requests that carry browser-style credentials
  const hasCookie = !!request.headers.get("cookie");
  const hasAuth = !!request.headers.get("authorization");
  if (hasCookie || hasAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
