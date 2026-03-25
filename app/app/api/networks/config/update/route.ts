import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { isValidNetworkId } from "@/lib/constants";

const ALLOWED_FIELDS = ["displayName", "isActive", "displayOrder", "color", "notes", "settings"];

export async function PATCH(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const body = await request.json();
    const { networkId, ...updates } = body;

    if (!networkId || !isValidNetworkId(networkId)) {
      return NextResponse.json({ error: "Invalid or missing networkId" }, { status: 400 });
    }

    const filteredUpdates: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (key in updates) {
        filteredUpdates[key] = updates[key];
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    filteredUpdates.updatedAt = FieldValue.serverTimestamp();

    const configRef = adminDb
      .collection("users")
      .doc(uid)
      .collection("networkConfigs")
      .doc(networkId);

    await configRef.set(filteredUpdates, { merge: true });

    const updated = await configRef.get();
    return NextResponse.json({ config: { id: updated.id, ...updated.data() } });
  } catch (error) {
    console.error("PATCH /api/networks/config/update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
