import { NextResponse } from "next/server";
import { SUPPORTED_NETWORKS } from "@/lib/constants";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";

const RATE_LIMIT_CONFIG: Record<string, { requestsPerHour: number; requestsPerDay: number }> = {
  exoclick: { requestsPerHour: 100, requestsPerDay: 1000 },
  rollerads: { requestsPerHour: 60, requestsPerDay: 500 },
  zeydoo: { requestsPerHour: 60, requestsPerDay: 500 },
  propush: { requestsPerHour: 60, requestsPerDay: 500 },
};

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;

  return NextResponse.json({
    config: RATE_LIMIT_CONFIG,
    networks: SUPPORTED_NETWORKS,
  });
}
