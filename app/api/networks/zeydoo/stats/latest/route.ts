import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { serializeDoc } from "@/lib/networks/network-helpers";

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const snapshot = await adminDb
      .collection("adStats")
      .where("uid", "==", uid)
      .where("networkId", "==", "zeydoo")
      .orderBy("date", "desc")
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ error: "No stats available" }, { status: 404 });
    }

    const latest = serializeDoc(snapshot.docs[0]);

    return NextResponse.json({
      networkId: "zeydoo",
      latest,
    });
  } catch (error) {
    console.error("GET /api/networks/zeydoo/stats/latest error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
