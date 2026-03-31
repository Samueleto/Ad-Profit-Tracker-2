import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { isValidNetworkId } from "@/lib/constants";

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const { searchParams } = new URL(request.url);
    const networkId = searchParams.get("networkId");

    if (networkId && !isValidNetworkId(networkId)) {
      return NextResponse.json({ error: "Invalid networkId" }, { status: 400 });
    }

    // Query recent sync audit logs scoped to uid
    let query = adminDb
      .collection("auditLogs")
      .where("userId", "==", uid)
      .where("action", "in", ["sync_completed", "sync_failed"])
      .orderBy("createdAt", "desc")
      .limit(200) as FirebaseFirestore.Query;

    if (networkId) {
      query = adminDb
        .collection("auditLogs")
        .where("userId", "==", uid)
        .where("networkId", "==", networkId)
        .where("action", "in", ["sync_completed", "sync_failed"])
        .orderBy("createdAt", "desc")
        .limit(200);
    }

    const snapshot = await query.get();

    let successCount = 0;
    let failureCount = 0;
    const networkBreakdown: Record<string, { success: number; failure: number }> = {};

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const net = data.networkId || "unknown";
      if (!networkBreakdown[net]) networkBreakdown[net] = { success: 0, failure: 0 };

      if (data.action === "sync_completed") {
        successCount++;
        networkBreakdown[net].success++;
      } else {
        failureCount++;
        networkBreakdown[net].failure++;
      }
    }

    return NextResponse.json({
      networkId: networkId || null,
      successCount,
      failureCount,
      total: successCount + failureCount,
      networkBreakdown,
    });
  } catch (error) {
    console.error("GET /api/errors/summary error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
