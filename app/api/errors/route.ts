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
    const status = searchParams.get("status"); // active, dismissed
    const networkId = searchParams.get("networkId");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);

    let query = adminDb
      .collection("syncErrors")
      .where("uid", "==", uid) as FirebaseFirestore.Query;

    if (status) query = query.where("status", "==", status);
    if (networkId) query = query.where("networkId", "==", networkId);

    query = query.orderBy("createdAt", "desc").limit(limit);

    const snapshot = await query.get();
    const errors = snapshot.docs.map(serializeDoc).filter(Boolean);

    return NextResponse.json({ errors, total: errors.length });
  } catch (error) {
    console.error("GET /api/errors error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
