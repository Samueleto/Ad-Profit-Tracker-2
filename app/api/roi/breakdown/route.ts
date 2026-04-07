import { NextResponse } from "next/server";
import NodeCache from "node-cache";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { computeRoi } from "@/lib/roi/formula";

const breakdownCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

const VALID_DIMENSIONS = new Set(["network", "country", "daily"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 90;

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";
  const dimension = searchParams.get("dimension") ?? "";

  // Input validation
  if (!dateFrom || !DATE_RE.test(dateFrom)) {
    return NextResponse.json({ error: "dateFrom is required and must be YYYY-MM-DD" }, { status: 400 });
  }
  if (!dateTo || !DATE_RE.test(dateTo)) {
    return NextResponse.json({ error: "dateTo is required and must be YYYY-MM-DD" }, { status: 400 });
  }
  if (dateFrom > dateTo) {
    return NextResponse.json({ error: "dateFrom must be <= dateTo" }, { status: 400 });
  }
  const diffDays = Math.round((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000);
  if (diffDays > MAX_RANGE_DAYS) {
    return NextResponse.json({ error: `Date range cannot exceed ${MAX_RANGE_DAYS} days` }, { status: 400 });
  }
  if (!VALID_DIMENSIONS.has(dimension)) {
    return NextResponse.json({ error: "dimension must be one of: network, country, daily" }, { status: 400 });
  }

  // uid-prefixed cache key prevents cross-user cache hits
  const cacheKey = `${uid}_roi_breakdown_${dateFrom}_${dateTo}_${dimension}`;
  const cached = breakdownCache.get(cacheKey);
  if (cached !== undefined) {
    return NextResponse.json({ ...cached as object, fromCache: true });
  }

  try {
    // uid filter always from verified token — never from query params
    const snapshot = await adminDb
      .collection("adStats")
      .where("uid", "==", uid)
      .where("date", ">=", dateFrom)
      .where("date", "<=", dateTo)
      .get();

    const groups: Record<string, { revenue: number; cost: number; impressions: number; clicks: number }> = {};

    snapshot.forEach((doc) => {
      const d = doc.data();
      let key: string;
      if (dimension === "network") key = (d.networkId as string) || "unknown";
      else if (dimension === "country") key = (d.country as string) || "unknown";
      else key = d.date as string; // daily

      if (!groups[key]) groups[key] = { revenue: 0, cost: 0, impressions: 0, clicks: 0 };
      groups[key].revenue += Number(d.revenue) || 0;
      groups[key].cost += Number(d.cost) || 0;
      groups[key].impressions += Number(d.impressions) || 0;
      groups[key].clicks += Number(d.clicks) || 0;
    });

    const breakdown = Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => ({
        [dimension]: key,
        ...val,
        roi: computeRoi(val.revenue, val.cost),
      }));

    const result = {
      dateFrom,
      dateTo,
      dimension,
      breakdown,
      rows: breakdown,
      networks: breakdown,
      countries: breakdown,
      total: breakdown.length,
      summary: breakdown.reduce((acc, b) => {
        const row = b as Record<string, number>;
        acc.totalRevenue = (acc.totalRevenue ?? 0) + (row.revenue ?? 0);
        acc.totalCost = (acc.totalCost ?? 0) + (row.cost ?? 0);
        return acc;
      }, {} as Record<string, number>),
      cachedAt: new Date().toISOString(),
    };

    breakdownCache.set(cacheKey, result);
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/roi/breakdown error:", error);
    return NextResponse.json({ error: "Failed to retrieve data. Please try again." }, { status: 500 });
  }
}
