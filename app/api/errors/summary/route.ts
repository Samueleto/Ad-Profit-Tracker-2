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
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    if (networkId && !isValidNetworkId(networkId)) {
      return NextResponse.json({ error: "Invalid networkId" }, { status: 400 });
    }

    // Query recent sync audit logs scoped to uid
    let query = adminDb
      .collection("auditLogs")
      .where("userId", "==", uid)
      .where("action", "in", ["sync_completed", "sync_failed"]) as FirebaseFirestore.Query;

    if (networkId) {
      query = query.where("networkId", "==", networkId);
    }
    if (dateFrom) {
      query = query.where("createdAt", ">=", new Date(dateFrom));
    }
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      query = query.where("createdAt", "<=", end);
    }
    query = query.orderBy("createdAt", "desc").limit(500);

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

    const total = successCount + failureCount;
    const overallSuccessRate = total > 0 ? successCount / total : 0;
    const networks = Object.entries(networkBreakdown).map(([netId, { success, failure }]) => ({
      networkId: netId,
      successRate: (success + failure) > 0 ? success / (success + failure) : 0,
      failureCount: failure,
    }));
    const mostProblematicNetwork = networks.length > 0
      ? networks.reduce((a, b) => a.failureCount > b.failureCount ? a : b).networkId
      : null;

    return NextResponse.json({
      networkId: networkId || null,
      successCount,
      failureCount,
      total,
      networkBreakdown,
      overallSuccessRate,
      totalFailures: failureCount,
      mostProblematicNetwork,
      networks,
    });
  } catch (error) {
    console.error("GET /api/errors/summary error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
