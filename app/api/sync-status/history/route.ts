import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { isValidNetworkId } from "@/lib/constants";
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
      .collection("auditLogs")
      .where("uid", "==", uid)
      .where("action", "in", ["sync_completed", "sync_failed", "sync_triggered"])
      .orderBy("timestamp", "desc")
      .limit(limit);

    if (networkId && isValidNetworkId(networkId)) {
      query = adminDb
        .collection("auditLogs")
        .where("uid", "==", uid)
        .where("networkId", "==", networkId)
        .where("action", "in", ["sync_completed", "sync_failed", "sync_triggered"])
        .orderBy("timestamp", "desc")
        .limit(limit);
    }

    const snapshot = await query.get();
    const history = snapshot.docs.map(serializeDoc);

    return NextResponse.json({ history, total: history.length });
  } catch (error) {
    console.error("GET /api/sync-status/history error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
