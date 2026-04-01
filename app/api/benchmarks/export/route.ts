import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "json";

    // Get benchmark targets
    const targetsDoc = await adminDb
      .collection("users")
      .doc(uid)
      .collection("settings")
      .doc("benchmarks")
      .get();

    const targets = targetsDoc.exists ? targetsDoc.data() || {} : {};

    // Get performance data for last 30 days
    const today = new Date();
    const dateTo = today.toISOString().split("T")[0];
    const dateFrom = new Date(today.getTime() - 30 * 86400000).toISOString().split("T")[0];

    const snapshot = await adminDb
      .collection("adStats")
      .where("uid", "==", uid)
      .where("date", ">=", dateFrom)
      .where("date", "<=", dateTo)
      .get();

    const byNetwork: Record<string, { revenue: number; cost: number; impressions: number; clicks: number }> = {};

    for (const doc of snapshot.docs) {
      const d = doc.data();
      if (!byNetwork[d.networkId]) {
        byNetwork[d.networkId] = { revenue: 0, cost: 0, impressions: 0, clicks: 0 };
      }
      byNetwork[d.networkId].revenue += Number(d.revenue) || 0;
      byNetwork[d.networkId].cost += Number(d.cost) || 0;
      byNetwork[d.networkId].impressions += Number(d.impressions) || 0;
      byNetwork[d.networkId].clicks += Number(d.clicks) || 0;
    }

    const rows = Object.entries(byNetwork).map(([networkId, data]) => {
      const profit = data.revenue - data.cost;
      const roi = data.cost > 0 ? (profit / data.cost) * 100 : 0;
      return { networkId, ...data, profit, roi };
    });

    if (format === "csv") {
      const header = "networkId,revenue,cost,profit,roi,impressions,clicks\n";
      const csvRows = rows.map((r) =>
        [r.networkId, r.revenue, r.cost, r.profit, r.roi.toFixed(2), r.impressions, r.clicks].join(",")
      );
      return new Response(header + csvRows.join("\n"), {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": 'attachment; filename="benchmarks-export.csv"',
        },
      });
    }

    return NextResponse.json({
      targets,
      performance: rows,
      dateFrom,
      dateTo,
      exportedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("GET /api/benchmarks/export error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
