import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { serializeDoc } from "@/lib/networks/network-helpers";

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);

    const snapshot = await adminDb
      .collection("reconciliationReports")
      .where("uid", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    const reports = snapshot.docs.map(serializeDoc);

    return NextResponse.json({ reports, total: reports.length });
  } catch (error) {
    console.error("GET /api/reconciliation/status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
