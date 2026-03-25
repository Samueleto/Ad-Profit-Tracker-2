import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { isValidNetworkId } from "@/lib/constants";

export async function PATCH(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const body = await request.json();
    const { order } = body; // Array of { networkId, displayOrder }

    if (!Array.isArray(order) || order.length === 0) {
      return NextResponse.json({ error: "order must be a non-empty array" }, { status: 400 });
    }

    for (const item of order) {
      if (!item.networkId || !isValidNetworkId(item.networkId) || typeof item.displayOrder !== "number") {
        return NextResponse.json({ error: "Each item must have valid networkId and displayOrder" }, { status: 400 });
      }
    }

    const batch = adminDb.batch();
    for (const { networkId, displayOrder } of order) {
      const ref = adminDb.collection("users").doc(uid).collection("networkConfigs").doc(networkId);
      batch.set(ref, { displayOrder, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }

    await batch.commit();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/networks/config/reorder error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
