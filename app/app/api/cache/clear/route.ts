import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { isValidNetworkId } from "@/lib/constants";

export async function POST(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const body = await request.json().catch(() => ({}));
    const { networkId } = body;

    const rawResponsesRef = adminDb.collection("users").doc(uid).collection("rawResponses");

    if (networkId && isValidNetworkId(networkId)) {
      await rawResponsesRef.doc(networkId).delete();
      return NextResponse.json({ success: true, cleared: 1 });
    }

    const snapshot = await rawResponsesRef.get();
    const batch = adminDb.batch();
    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();

    return NextResponse.json({ success: true, cleared: snapshot.size });
  } catch (error) {
    console.error("POST /api/cache/clear error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
