import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { isValidNetworkId } from "@/lib/constants";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ networkId: string }> }
) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const { networkId } = await params;

    if (!networkId || !isValidNetworkId(networkId)) {
      return NextResponse.json({ error: "Invalid networkId" }, { status: 400 });
    }

    const configDoc = await adminDb
      .collection("users")
      .doc(uid)
      .collection("networkConfigs")
      .doc(networkId)
      .get();

    if (!configDoc.exists) {
      return NextResponse.json({ error: "Network config not found" }, { status: 404 });
    }

    return NextResponse.json({ config: { id: configDoc.id, ...configDoc.data() } });
  } catch (error) {
    console.error("GET /api/networks/config/[networkId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
