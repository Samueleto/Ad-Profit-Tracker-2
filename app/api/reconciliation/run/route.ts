import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { SUPPORTED_NETWORKS } from "@/lib/constants";
import { serializeDoc } from "@/lib/networks/network-helpers";

// In-memory rate limit: 10 reconciliation runs per hour per uid
const runRateLimit = new Map<string, { count: number; resetAt: number }>();

export async function POST(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  // Rate limit: 10 runs per hour
  const now = Date.now();
  const entry = runRateLimit.get(uid);
  if (entry && now < entry.resetAt && entry.count >= 10) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      { error: "Rate limit exceeded. Maximum 10 reconciliation runs per hour." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }
  if (!entry || now >= entry.resetAt) {
    runRateLimit.set(uid, { count: 1, resetAt: now + 60 * 60 * 1000 });
  } else {
    entry.count++;
  }

  try {
    const body = await request.json();
    const { dateFrom, dateTo } = body;

    if (!dateFrom || !dateTo) {
      return NextResponse.json({ error: "dateFrom and dateTo are required" }, { status: 400 });
    }

    // Fetch stats for all networks
    const networkSummaries: Record<string, {
      revenue: number;
      cost: number;
      impressions: number;
      clicks: number;
      recordCount: number;
    }> = {};

    for (const networkId of SUPPORTED_NETWORKS) {
      const snapshot = await adminDb
        .collection("adStats")
        .where("uid", "==", uid)
        .where("networkId", "==", networkId)
        .where("date", ">=", dateFrom)
        .where("date", "<=", dateTo)
        .get();

      const totals = snapshot.docs.reduce(
        (acc, doc) => {
          const d = doc.data();
          acc.revenue += Number(d.revenue) || 0;
          acc.cost += Number(d.cost) || 0;
          acc.impressions += Number(d.impressions) || 0;
          acc.clicks += Number(d.clicks) || 0;
          acc.recordCount++;
          return acc;
        },
        { revenue: 0, cost: 0, impressions: 0, clicks: 0, recordCount: 0 }
      );

      networkSummaries[networkId] = totals;
    }

    // Compute totals
    const totalRevenue = Object.values(networkSummaries).reduce((a, b) => a + b.revenue, 0);
    const totalCost = Object.values(networkSummaries).reduce((a, b) => a + b.cost, 0);
    const netProfit = totalRevenue - totalCost;

    const reportRef = await adminDb.collection("reconciliationReports").add({
      uid,
      dateFrom,
      dateTo,
      networkSummaries,
      totalRevenue,
      totalCost,
      netProfit,
      status: "completed",
      createdAt: FieldValue.serverTimestamp(),
    });

    const report = await reportRef.get();
    return NextResponse.json({ report: serializeDoc(report) });
  } catch (error) {
    console.error("POST /api/reconciliation/run error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
