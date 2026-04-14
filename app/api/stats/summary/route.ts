import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { isValidNetworkId } from "@/lib/constants";
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
    const networkId = searchParams.get("networkId");

    const dateErr = validateDateRange(dateFrom, dateTo);
    if (dateErr) return NextResponse.json({ error: dateErr }, { status: 400 });

    if (networkId && !isValidNetworkId(networkId)) {
      return NextResponse.json({ error: "Invalid networkId" }, { status: 400 });
    }

    let query = adminDb
      .collection("adStats")
      .where("uid", "==", uid) as FirebaseFirestore.Query;

    if (networkId) {
      query = query.where("networkId", "==", networkId);
    }

    if (dateFrom) {
      query = query.where("date", ">=", dateFrom);
    }

    const snapshot = await query.get();
    let stats = snapshot.docs.map(serializeDoc).filter(Boolean);

    if (dateTo) {
      stats = stats.filter((s) => {
        const d = (s as Record<string, unknown>)?.date;
        return typeof d === "string" && d <= dateTo;
      });
    }

    const totals = stats.reduce(
      (acc: { impressions: number; clicks: number; revenue: number; cost: number }, s) => {
        const row = s as Record<string, unknown>;
        acc.impressions += Number(row.impressions) || 0;
        acc.clicks += Number(row.clicks) || 0;
        acc.revenue += Number(row.revenue) || 0;
        acc.cost += Number(row.cost) || 0;
        return acc;
      },
      { impressions: 0, clicks: 0, revenue: 0, cost: 0 }
    );

    const profit = totals.revenue - totals.cost;
    const ctr = totals.impressions > 0 ? totals.clicks / totals.impressions : 0;

    // Build per-network breakdown for HistoricalDataSection summary table
    const networkMap: Record<string, { revenue: number; cost: number; lastSyncedAt: string | null; lastSyncStatus: string | null }> = {};
    for (const s of stats) {
      const row = s as Record<string, unknown>;
      const nid = String(row.networkId ?? 'unknown');
      if (!networkMap[nid]) {
        networkMap[nid] = { revenue: 0, cost: 0, lastSyncedAt: null, lastSyncStatus: null };
      }
      networkMap[nid].revenue += Number(row.revenue) || 0;
      networkMap[nid].cost += Number(row.cost) || 0;
      const syncedAt = row.syncedAt as string | null;
      if (syncedAt && (!networkMap[nid].lastSyncedAt || syncedAt > networkMap[nid].lastSyncedAt!)) {
        networkMap[nid].lastSyncedAt = syncedAt;
        networkMap[nid].lastSyncStatus = 'success';
      }
    }
    const perNetwork = Object.entries(networkMap).map(([nid, v]) => ({ networkId: nid, ...v }));

    return NextResponse.json({
      networkId: networkId || null,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      totals: { ...totals, profit, ctr },
      perNetwork,
      recordCount: stats.length,
    });
  } catch (error) {
    console.error("GET /api/stats/summary error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
