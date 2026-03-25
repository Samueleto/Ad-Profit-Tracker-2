import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { isValidNetworkId } from "@/lib/constants";
import { serializeDoc } from "@/lib/networks/network-helpers";

export async function POST(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const body = await request.json();
    const { filters = {}, limit: reqLimit = 100 } = body;
    const { dateFrom, dateTo, networkId, country, minRevenue, maxRevenue } = filters;
    const limit = Math.min(reqLimit, 1000);

    let query = adminDb
      .collection("adStats")
      .where("uid", "==", uid)
      .orderBy("date", "desc")
      .limit(limit);

    if (networkId && isValidNetworkId(networkId)) {
      query = adminDb
        .collection("adStats")
        .where("uid", "==", uid)
        .where("networkId", "==", networkId)
        .orderBy("date", "desc")
        .limit(limit);
    }

    const snapshot = await query.get();
    let results = snapshot.docs.map(serializeDoc).filter(Boolean);

    if (dateFrom) results = results.filter((r) => (r as Record<string, unknown>).date as string >= dateFrom);
    if (dateTo) results = results.filter((r) => (r as Record<string, unknown>).date as string <= dateTo);
    if (country) results = results.filter((r) => (r as Record<string, unknown>).country === country);
    if (minRevenue != null) results = results.filter((r) => Number((r as Record<string, unknown>).revenue) >= parseFloat(minRevenue));
    if (maxRevenue != null) results = results.filter((r) => Number((r as Record<string, unknown>).revenue) <= parseFloat(maxRevenue));

    return NextResponse.json({ data: results, total: results.length, appliedFilters: filters });
  } catch (error) {
    console.error("POST /api/filters/apply error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
