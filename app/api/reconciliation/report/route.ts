import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { SUPPORTED_NETWORKS } from "@/lib/constants";
import { serializeDoc } from "@/lib/networks/network-helpers";

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    if (!dateFrom || !dateTo) {
      return NextResponse.json({ error: "dateFrom and dateTo are required" }, { status: 400 });
    }

    // Get latest reconciliation report
    const snapshot = await adminDb
      .collection("reconciliationReports")
      .where("uid", "==", uid)
      .where("dateFrom", "==", dateFrom)
      .where("dateTo", "==", dateTo)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ error: "No reconciliation report found for this date range" }, { status: 404 });
    }

    return NextResponse.json({ report: serializeDoc(snapshot.docs[0]) });
  } catch (error) {
    console.error("GET /api/reconciliation/report error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
