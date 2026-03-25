import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { SUPPORTED_NETWORKS } from "@/lib/constants";

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const groupBy = searchParams.get("groupBy") || "day"; // day, week, month

    const today = new Date();
    const defaultEnd = today.toISOString().split("T")[0];
    const defaultStart = new Date(today.getTime() - 30 * 86400000).toISOString().split("T")[0];
    const from = dateFrom || defaultStart;
    const to = dateTo || defaultEnd;

    const snapshot = await adminDb
      .collection("adStats")
      .where("uid", "==", uid)
      .where("date", ">=", from)
      .where("date", "<=", to)
      .orderBy("date", "asc")
      .get();

    const byDate: Record<string, { revenue: number; cost: number; impressions: number; clicks: number }> = {};

    for (const doc of snapshot.docs) {
      const d = doc.data();
      let key = d.date as string;

      if (groupBy === "week") {
        const date = new Date(key);
        const weekStart = new Date(date.getTime() - date.getDay() * 86400000);
        key = weekStart.toISOString().split("T")[0];
      } else if (groupBy === "month") {
        key = key.substring(0, 7);
      }

      if (!byDate[key]) {
        byDate[key] = { revenue: 0, cost: 0, impressions: 0, clicks: 0 };
      }
      byDate[key].revenue += Number(d.revenue) || 0;
      byDate[key].cost += Number(d.cost) || 0;
      byDate[key].impressions += Number(d.impressions) || 0;
      byDate[key].clicks += Number(d.clicks) || 0;
    }

    const history = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => {
        const profit = data.revenue - data.cost;
        const roi = data.cost > 0 ? (profit / data.cost) * 100 : 0;
        return { date, ...data, profit, roi };
      });

    return NextResponse.json({ history, groupBy, dateFrom: from, dateTo: to });
  } catch (error) {
    console.error("GET /api/roi/history error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
