import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { isValidNetworkId } from "@/lib/constants";

export async function POST(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const body = await request.json();
    const { networkId } = body;

    // Get rate limit logs for this user (and optionally network)
    let query = adminDb
      .collection("rateLimitLogs")
      .where("uid", "==", uid)
      .limit(500);

    if (networkId && isValidNetworkId(networkId)) {
      query = adminDb
        .collection("rateLimitLogs")
        .where("uid", "==", uid)
        .where("networkId", "==", networkId)
        .limit(500);
    }

    const snapshot = await query.get();
    const batch = adminDb.batch();
    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();

    return NextResponse.json({ success: true, cleared: snapshot.size });
  } catch (error) {
    console.error("POST /api/rate-limits/reset error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
