import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { serializeDoc } from "@/lib/networks/network-helpers";

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const { searchParams } = new URL(request.url);
    const networkId = searchParams.get("networkId");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);

    let query = adminDb
      .collection("rateLimitLogs")
      .where("uid", "==", uid)
      .orderBy("timestamp", "desc")
      .limit(limit);

    if (networkId) {
      query = adminDb
        .collection("rateLimitLogs")
        .where("uid", "==", uid)
        .where("networkId", "==", networkId)
        .orderBy("timestamp", "desc")
        .limit(limit);
    }

    const snapshot = await query.get();
    const history = snapshot.docs.map(serializeDoc);

    return NextResponse.json({ history, total: history.length });
  } catch (error) {
    console.error("GET /api/rate-limits/history error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
