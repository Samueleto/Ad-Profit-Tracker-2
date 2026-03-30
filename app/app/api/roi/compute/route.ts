import { NextResponse } from "next/server";
import NodeCache from "node-cache";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { computeRoi, getColorCode, getRoiIndicator } from "@/lib/roi/formula";
import { isValidNetworkId } from "@/lib/constants";

const roiCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

const VALID_GROUP_BY = new Set(["total", "daily", "country"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 90;

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";
  const networkId = searchParams.get("networkId") ?? "";
  const groupBy = searchParams.get("groupBy") ?? "total";

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
  if (networkId && !isValidNetworkId(networkId)) {
    return NextResponse.json({ error: "Invalid networkId" }, { status: 400 });
  }
  if (!VALID_GROUP_BY.has(groupBy)) {
    return NextResponse.json({ error: "groupBy must be one of: total, daily, country" }, { status: 400 });
  }

  // uid-prefixed cache key prevents cross-user cache hits
  const cacheKey = `${uid}_roi_${dateFrom}_${dateTo}_${networkId || "all"}_${groupBy}`;
  const cached = roiCache.get(cacheKey);
  if (cached !== undefined) {
    return NextResponse.json({ ...cached as object, fromCache: true });
  }

  try {
    // userId filter always comes from the verified token — never from params
    let statsQuery = adminDb
      .collection("adStats")
      .where("userId", "==", uid)
      .where("date", ">=", dateFrom)
      .where("date", "<=", dateTo) as FirebaseFirestore.Query;

    if (networkId && isValidNetworkId(networkId)) {
      statsQuery = statsQuery.where("networkId", "==", networkId);
    }

    const snapshot = await statsQuery.get();

    let totalRevenue = 0;
    let totalCost = 0;
    const grouped: Record<string, { revenue: number; cost: number; impressions: number; clicks: number }> = {};

    snapshot.forEach((doc) => {
      const d = doc.data();
      totalRevenue += Number(d.revenue) || 0;
      totalCost += Number(d.cost) || 0;

      let groupKey = "total";
      if (groupBy === "daily") groupKey = d.date as string;
      else if (groupBy === "country") groupKey = (d.country as string) || "unknown";

      if (!grouped[groupKey]) grouped[groupKey] = { revenue: 0, cost: 0, impressions: 0, clicks: 0 };
      grouped[groupKey].revenue += Number(d.revenue) || 0;
      grouped[groupKey].cost += Number(d.cost) || 0;
      grouped[groupKey].impressions += Number(d.impressions) || 0;
      grouped[groupKey].clicks += Number(d.clicks) || 0;
    });

    const roi = computeRoi(totalRevenue, totalCost);
    const result = {
      dateFrom,
      dateTo,
      networkId: networkId || null,
      groupBy,
      roi,
      colorCode: getColorCode(roi),
      roiIndicator: getRoiIndicator(roi),
      totalRevenue,
      totalCost,
      netProfit: totalRevenue - totalCost,
      breakdown: Object.entries(grouped).map(([key, val]) => ({
        group: key,
        ...val,
        roi: computeRoi(val.revenue, val.cost),
      })),
      cachedAt: new Date().toISOString(),
    };

    roiCache.set(cacheKey, result);
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/roi/compute error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
