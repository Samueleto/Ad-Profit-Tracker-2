import { NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;

  return NextResponse.json({
    config: {
      rawResponseTtlHours: 24,
      statsCacheTtlMinutes: 15,
      dashboardCacheTtlMinutes: 5,
      maxCacheEntries: 100,
    },
  });
}
