import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;

  const { token } = authResult;
  const uid = token.uid;

  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    let query = adminDb
      .collection("adStats")
      .where("userId", "==", uid) as FirebaseFirestore.Query;

    if (startDate) {
      query = query.where("date", ">=", startDate);
    }
    if (endDate) {
      query = query.where("date", "<=", endDate);
    }

    const snapshot = await query.get();

    // Aggregate metrics
    let totalRevenue = 0;
    let totalCost = 0;
    let totalImpressions = 0;
    let totalClicks = 0;

    const byNetwork: Record<string, { revenue: number; cost: number; impressions: number; clicks: number }> = {};
    const byDate: Record<string, { revenue: number; cost: number }> = {};

    snapshot.forEach((doc) => {
      const data = doc.data();
      const revenue = data.revenue || 0;
      const cost = data.cost || 0;
      const impressions = data.impressions || 0;
      const clicks = data.clicks || 0;

      totalRevenue += revenue;
      totalCost += cost;
      totalImpressions += impressions;
      totalClicks += clicks;

      // By network
      if (!byNetwork[data.networkId]) {
        byNetwork[data.networkId] = { revenue: 0, cost: 0, impressions: 0, clicks: 0 };
      }
      byNetwork[data.networkId].revenue += revenue;
      byNetwork[data.networkId].cost += cost;
      byNetwork[data.networkId].impressions += impressions;
      byNetwork[data.networkId].clicks += clicks;

      // By date
      if (!byDate[data.date]) {
        byDate[data.date] = { revenue: 0, cost: 0 };
      }
      byDate[data.date].revenue += revenue;
      byDate[data.date].cost += cost;
    });

    const totalProfit = totalRevenue - totalCost;
    const roi = totalCost > 0 ? ((totalRevenue - totalCost) / totalCost) * 100 : null;
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : null;

    // Convert byDate to sorted array
    const profitTrend = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { revenue, cost }]) => ({
        date,
        revenue,
        cost,
        profit: revenue - cost,
      }));

    // Convert byNetwork to array
    const networkBreakdown = Object.entries(byNetwork).map(
      ([networkId, { revenue, cost, impressions, clicks }]) => ({
        networkId,
        revenue,
        cost,
        profit: revenue - cost,
        impressions,
        clicks,
      })
    );

    return NextResponse.json({
      totalRevenue,
      totalCost,
      totalProfit,
      totalImpressions,
      totalClicks,
      roi,
      ctr,
      profitTrend,
      networkBreakdown,
      recordCount: snapshot.size,
    });
  } catch (error) {
    console.error("dashboard/metrics error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
