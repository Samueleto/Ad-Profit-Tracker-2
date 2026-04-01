import { NextResponse } from "next/server";
import { verifyInternalSecret } from "@/lib/firebase-admin/verify-internal-secret";

// POST /api/cache/warm
// Internal endpoint — only callable with the correct x-internal-secret header.
// Firebase user tokens are NOT an accepted auth method here.
export async function POST(request: Request) {
  // Reject any request that carries a Firebase Bearer token — the two auth paths
  // must remain completely separate.
  if (request.headers.get("authorization")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authError = verifyInternalSecret(request);
  if (authError) return authError;

  try {
    // Cache warming is a no-op in the current implementation — future warming
    // logic (e.g. pre-fetching stats for active users) would go here.
    return NextResponse.json({
      warmed: true,
      warmedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("POST /api/cache/warm error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
