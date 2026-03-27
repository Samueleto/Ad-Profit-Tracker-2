import { NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";

// Stub endpoint — invalidates server-side cache for dashboard metrics.
// The dashboard hook calls this before re-fetching to bust any cached responses.
export async function POST(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;

  // Stub: return success so the dashboard refresh flow continues.
  // If a server-side metrics cache is added later, invalidation logic goes here.
  return NextResponse.json({ invalidated: true });
}
