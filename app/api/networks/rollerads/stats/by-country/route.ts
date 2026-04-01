import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { serializeDoc } from "@/lib/networks/network-helpers";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 90;

function validateDateRange(dateFrom: string | null, dateTo: string | null): string | null {
  if (dateFrom && !DATE_RE.test(dateFrom)) return "dateFrom must be in YYYY-MM-DD format";
  if (dateTo && !DATE_RE.test(dateTo)) return "dateTo must be in YYYY-MM-DD format";
  if (dateFrom && dateTo) {
    if (dateFrom > dateTo) return "dateFrom must be <= dateTo";
    const diff = Math.round(
      (new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000
    );
    if (diff > MAX_RANGE_DAYS) return `Date range cannot exceed ${MAX_RANGE_DAYS} days`;
  }
  return null;
}

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const rawLimit = searchParams.get("limit");

    // Validate limit: must be integer between 1 and 100
    let limit = 10;
    if (rawLimit !== null) {
      const parsed = parseInt(rawLimit, 10);
      if (!Number.isInteger(parsed) || isNaN(parsed) || parsed < 1 || parsed > 100) {
        return NextResponse.json(
          { error: "limit must be an integer between 1 and 100" },
          { status: 400 }
        );
      }
      limit = parsed;
    }

    // Date validation
    const dateErr = validateDateRange(dateFrom, dateTo);
    if (dateErr) return NextResponse.json({ error: dateErr }, { status: 400 });

    let query = adminDb
      .collection("adStats")
      .where("uid", "==", uid)
      .where("networkId", "==", "rollerads")
      .where("country", "!=", null);

    if (dateFrom) {
      query = query.where("date", ">=", dateFrom);
    }

    const snapshot = await query.get();
    let docs = snapshot.docs.map(serializeDoc);

    if (dateTo) {
      docs = docs.filter((s) => {
        const d = s && (s as Record<string, unknown>).date;
        return typeof d === "string" && d <= dateTo;
      });
    }

    // Aggregate by country
    const countryMap = new Map<string, { impressions: number; clicks: number; revenue: number; cost: number; country: string }>();

    for (const doc of docs) {
      if (!doc) continue;
      const row = doc as Record<string, unknown>;
      const country = (row.country as string) || "unknown";
      const existing = countryMap.get(country) || { impressions: 0, clicks: 0, revenue: 0, cost: 0, country };
      existing.impressions += Number(row.impressions) || 0;
      existing.clicks += Number(row.clicks) || 0;
      existing.revenue += Number(row.revenue) || 0;
      existing.cost += Number(row.cost) || 0;
      countryMap.set(country, existing);
    }

    const results = Array.from(countryMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);

    return NextResponse.json({
      networkId: "rollerads",
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      limit,
      byCountry: results,
      total: results.length,
    });
  } catch (error) {
    console.error("GET /api/networks/rollerads/stats/by-country error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
