import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { isValidNetworkId } from "@/lib/constants";

const DEFAULT_CONFIGS: Record<string, Record<string, unknown>> = {
  exoclick: { displayName: "ExoClick", isActive: true, displayOrder: 1, color: "#ff6b35" },
  rollerads: { displayName: "RollerAds", isActive: true, displayOrder: 2, color: "#4ecdc4" },
  zeydoo: { displayName: "Zeydoo", isActive: true, displayOrder: 3, color: "#45b7d1" },
  propush: { displayName: "Propush", isActive: true, displayOrder: 4, color: "#96ceb4" },
};

export async function DELETE(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    let networkId: string | null = null;
    try {
      const body = await request.json();
      networkId = body?.networkId ?? null;
    } catch {
      // Fall back to query param for GET-style DELETE calls
      const { searchParams } = new URL(request.url);
      networkId = searchParams.get("networkId");
    }

    if (!networkId || !isValidNetworkId(networkId)) {
      return NextResponse.json({ error: "Invalid or missing networkId" }, { status: 400 });
    }

    const defaults = { ...DEFAULT_CONFIGS[networkId], updatedAt: FieldValue.serverTimestamp() };

    const configRef = adminDb.collection("users").doc(uid).collection("networkConfigs").doc(networkId);
    await configRef.set(defaults);

    return NextResponse.json({ success: true, config: { id: networkId, ...defaults } });
  } catch (error) {
    console.error("DELETE /api/networks/config/reset error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
