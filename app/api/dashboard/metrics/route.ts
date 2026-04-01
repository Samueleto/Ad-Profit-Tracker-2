import { NextResponse } from "next/server";
import NodeCache from "node-cache";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";

const metricsCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 90;

export async function GET(request: Request) {
  // Token verification is the first thing — before any Firestore reads or cache lookups
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    // Date format validation
    if (dateFrom && !DATE_RE.test(dateFrom)) {
      return NextResponse.json({ error: "dateFrom must be in YYYY-MM-DD format" }, { status: 400 });
    }
    if (dateTo && !DATE_RE.test(dateTo)) {
      return NextResponse.json({ error: "dateTo must be in YYYY-MM-DD format" }, { status: 400 });
    }

    // 90-day cap — server is the real security boundary
    if (dateFrom && dateTo) {
      if (dateFrom > dateTo) {
        return NextResponse.json({ error: "dateFrom must be <= dateTo" }, { status: 400 });
      }
      const diff = Math.round(
        (new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000
      );
      if (diff > MAX_RANGE_DAYS) {
        return NextResponse.json(
          { error: `Date range cannot exceed ${MAX_RANGE_DAYS} days` },
          { status: 400 }
        );
      }
    }

    // Uid-prefixed cache key — prevents cross-user cache hits
    const cacheKey = `${uid}_dashboard_metrics_${dateFrom || "all"}_${dateTo || "all"}`;
    const cached = metricsCache.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // All Firestore queries scoped to uid from verified token — never from params
    let query = adminDb
      .collection("adStats")
      .where("uid", "==", uid) as FirebaseFirestore.Query;

    if (dateFrom) {
      query = query.where("date", ">=", dateFrom);
    }
    if (dateTo) {
      query = query.where("date", "<=", dateTo);
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
      const revenue = Number(data.revenue) || 0;
      const cost = Number(data.cost) || 0;
      const impressions = Number(data.impressions) || 0;
      const clicks = Number(data.clicks) || 0;

      totalRevenue += revenue;
      totalCost += cost;
      totalImpressions += impressions;
      totalClicks += clicks;

      if (data.networkId) {
        if (!byNetwork[data.networkId]) {
          byNetwork[data.networkId] = { revenue: 0, cost: 0, impressions: 0, clicks: 0 };
        }
        byNetwork[data.networkId].revenue += revenue;
        byNetwork[data.networkId].cost += cost;
        byNetwork[data.networkId].impressions += impressions;
        byNetwork[data.networkId].clicks += clicks;
      }

      if (data.date) {
        if (!byDate[data.date]) {
          byDate[data.date] = { revenue: 0, cost: 0 };
        }
        byDate[data.date].revenue += revenue;
        byDate[data.date].cost += cost;
      }
    });

    const totalProfit = totalRevenue - totalCost;
    const roi = totalCost > 0 ? ((totalRevenue - totalCost) / totalCost) * 100 : null;
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : null;

    const dailySeries = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { revenue, cost }]) => ({
        date,
        revenue,
        cost,
        profit: revenue - cost,
      }));

    const perNetwork = Object.entries(byNetwork).map(
      ([networkId, { revenue, cost, impressions, clicks }]) => ({
        networkId,
        revenue,
        cost,
        profit: revenue - cost,
        impressions,
        clicks,
      })
    );

    const cachedAt = new Date().toISOString();

    const result = {
      kpis: {
        totalRevenue,
        totalCost,
        netProfit: totalProfit,
        roi,
        ctr,
        totalImpressions,
        totalClicks,
      },
      dailySeries,
      perNetwork,
      recordCount: snapshot.size,
      cachedAt,
    };

    metricsCache.set(cacheKey, result);

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/dashboard/metrics error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
