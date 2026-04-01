import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { SUPPORTED_NETWORKS } from "@/lib/constants";

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;

  const { token } = authResult;
  const uid = token.uid;

  try {
    const keysSnapshot = await adminDb
      .collection("users")
      .doc(uid)
      .collection("apiKeys")
      .get();

    const connectedNetworks = new Map<string, string>();
    keysSnapshot.forEach((doc) => {
      const data = doc.data();
      // Never include encryptedKey in response
      connectedNetworks.set(doc.id, data.updatedAt?.toDate?.()?.toISOString() || null);
    });

    const statuses = SUPPORTED_NETWORKS.map((networkId) => ({
      networkId,
      status: connectedNetworks.has(networkId) ? "connected" : "not_connected",
      updatedAt: connectedNetworks.get(networkId) || null,
    }));

    return NextResponse.json(statuses);
  } catch (error) {
    console.error("keys/status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
