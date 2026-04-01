import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { isValidNetworkId } from "@/lib/constants";
import { serializeDoc } from "@/lib/networks/network-helpers";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const { searchParams } = new URL(request.url);
    const networkId = searchParams.get("networkId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);

    if (networkId && !isValidNetworkId(networkId)) {
      return NextResponse.json({ error: "Invalid networkId" }, { status: 400 });
    }

    if (dateFrom && !DATE_RE.test(dateFrom)) {
      return NextResponse.json({ error: "dateFrom must be in YYYY-MM-DD format" }, { status: 400 });
    }
    if (dateTo && !DATE_RE.test(dateTo)) {
      return NextResponse.json({ error: "dateTo must be in YYYY-MM-DD format" }, { status: 400 });
    }

    // Anomalies are adStats docs where validationStatus indicates an issue
    let query = adminDb
      .collection("adStats")
      .where("uid", "==", uid)
      .where("validationStatus", "in", ["anomaly", "warning"]) as FirebaseFirestore.Query;

    if (networkId) {
      query = query.where("networkId", "==", networkId);
    }

    if (dateFrom) {
      query = query.where("date", ">=", dateFrom);
    }

    const snapshot = await query.orderBy("date", "desc").limit(limit).get();
    let anomalies = snapshot.docs.map(serializeDoc).filter(Boolean);

    if (dateTo) {
      anomalies = anomalies.filter((a) => {
        const d = (a as Record<string, unknown>)?.date;
        return typeof d === "string" && d <= dateTo;
      });
    }

    return NextResponse.json({
      anomalies,
      total: anomalies.length,
      networkId: networkId || null,
    });
  } catch (error) {
    console.error("GET /api/reconciliation/anomalies error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
