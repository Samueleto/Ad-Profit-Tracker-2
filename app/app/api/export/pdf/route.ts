import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { SUPPORTED_NETWORKS } from "@/lib/constants";

export async function POST(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const body = await request.json();
    const { dateFrom, dateTo, title, includeCharts = false } = body;

    const today = new Date();
    const defaultEnd = today.toISOString().split("T")[0];
    const defaultStart = new Date(today.getTime() - 30 * 86400000).toISOString().split("T")[0];
    const from = dateFrom || defaultStart;
    const to = dateTo || defaultEnd;

    // Gather data for PDF
    const snapshot = await adminDb
      .collection("adStats")
      .where("uid", "==", uid)
      .where("date", ">=", from)
      .where("date", "<=", to)
      .orderBy("date", "asc")
      .get();

    const networkTotals: Record<string, { revenue: number; cost: number; profit: number; impressions: number; clicks: number }> = {};
    let totalRevenue = 0, totalCost = 0, totalImpressions = 0, totalClicks = 0;

    for (const doc of snapshot.docs) {
      const d = doc.data();
      const net = d.networkId as string;
      if (!networkTotals[net]) networkTotals[net] = { revenue: 0, cost: 0, profit: 0, impressions: 0, clicks: 0 };
      const revenue = Number(d.revenue) || 0;
      const cost = Number(d.cost) || 0;
      networkTotals[net].revenue += revenue;
      networkTotals[net].cost += cost;
      networkTotals[net].profit += revenue - cost;
      networkTotals[net].impressions += Number(d.impressions) || 0;
      networkTotals[net].clicks += Number(d.clicks) || 0;
      totalRevenue += revenue;
      totalCost += cost;
      totalImpressions += Number(d.impressions) || 0;
      totalClicks += Number(d.clicks) || 0;
    }

    const reportTitle = title || `Ad Performance Report: ${from} to ${to}`;
    const generatedAt = new Date().toISOString();

    // Return JSON representation of the report (client-side rendering to PDF)
    return NextResponse.json({
      report: {
        title: reportTitle,
        dateFrom: from,
        dateTo: to,
        generatedAt,
        summary: {
          totalRevenue,
          totalCost,
          totalProfit: totalRevenue - totalCost,
          totalImpressions,
          totalClicks,
          roi: totalCost > 0 ? ((totalRevenue - totalCost) / totalCost) * 100 : 0,
        },
        networkBreakdown: networkTotals,
        recordCount: snapshot.size,
        includeCharts,
      },
    });
  } catch (error) {
    console.error("POST /api/export/pdf error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
