import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { isValidNetworkId } from "@/lib/constants";

export async function DELETE(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;

  const { token } = authResult;
  const uid = token.uid;

  try {
    const body = await request.json();
    const { networkId } = body;

    if (!networkId || !isValidNetworkId(networkId)) {
      return NextResponse.json(
        { error: "Invalid networkId. Must be one of: exoclick, rollerads, zeydoo, propush" },
        { status: 400 }
      );
    }

    const docRef = adminDb.collection("users").doc(uid).collection("apiKeys").doc(networkId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    await docRef.delete();

    return NextResponse.json({ networkId, status: "disconnected" });
  } catch (error) {
    console.error("[keys/delete] Firestore error", { uid, ts: new Date().toISOString(), error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
