import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { SUPPORTED_NETWORKS } from "@/lib/constants";

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const now = Date.now();
    const hourAgo = new Date(now - 3600000).toISOString();

    const statuses: Record<string, unknown> = {};

    for (const networkId of SUPPORTED_NETWORKS) {
      const snapshot = await adminDb
        .collection("rateLimitLogs")
        .where("uid", "==", uid)
        .where("networkId", "==", networkId)
        .orderBy("timestamp", "desc")
        .limit(100)
        .get();

      const recentRequests = snapshot.docs.filter((doc) => {
        const ts = doc.data().timestamp?.toDate?.()?.toISOString();
        return ts && ts >= hourAgo;
      });

      statuses[networkId] = {
        networkId,
        requestsLastHour: recentRequests.length,
        limit: 100,
        remaining: Math.max(0, 100 - recentRequests.length),
        resetAt: new Date(now + 3600000).toISOString(),
      };
    }

    return NextResponse.json({ statuses });
  } catch (error) {
    console.error("GET /api/rate-limits/status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
