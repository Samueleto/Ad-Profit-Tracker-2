import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const format = searchParams.get("format") || "json";

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

    const rows = snapshot.docs.map((doc) => {
      const d = doc.data();
      const revenue = Number(d.revenue) || 0;
      const cost = Number(d.cost) || 0;
      const profit = revenue - cost;
      const roi = cost > 0 ? (profit / cost) * 100 : 0;
      return {
        date: d.date,
        networkId: d.networkId,
        revenue,
        cost,
        profit,
        roi: Math.round(roi * 100) / 100,
        impressions: Number(d.impressions) || 0,
        clicks: Number(d.clicks) || 0,
      };
    });

    if (format === "csv") {
      const header = "date,networkId,revenue,cost,profit,roi,impressions,clicks\n";
      const csvRows = rows.map((r) =>
        [r.date, r.networkId, r.revenue, r.cost, r.profit, r.roi, r.impressions, r.clicks].join(",")
      );
      const csv = header + csvRows.join("\n");

      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": 'attachment; filename="roi-export.csv"',
        },
      });
    }

    return NextResponse.json({ rows, total: rows.length, dateFrom: from, dateTo: to, exportedAt: new Date().toISOString() });
  } catch (error) {
    console.error("GET /api/roi/export error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
