import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { isValidNetworkId, SUPPORTED_NETWORKS } from "@/lib/constants";
import { serializeDoc } from "@/lib/networks/network-helpers";

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const networkId = searchParams.get("networkId");
    const country = searchParams.get("country");
    const minRevenue = searchParams.get("minRevenue");
    const maxRevenue = searchParams.get("maxRevenue");
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 1000);

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

    if (dateFrom) results = results.filter((r) => r!.date >= dateFrom);
    if (dateTo) results = results.filter((r) => r!.date <= dateTo);
    if (country) results = results.filter((r) => r!.country === country);
    if (minRevenue) results = results.filter((r) => Number(r!.revenue) >= parseFloat(minRevenue));
    if (maxRevenue) results = results.filter((r) => Number(r!.revenue) <= parseFloat(maxRevenue));

    return NextResponse.json({ data: results, total: results.length });
  } catch (error) {
    console.error("GET /api/filters/data error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
