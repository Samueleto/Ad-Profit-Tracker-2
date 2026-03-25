import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { decrypt } from "@/lib/encryption";
import { isValidNetworkId } from "@/lib/constants";
import axios from "axios";

const NETWORK_TEST_URLS: Record<string, string> = {
  exoclick: "https://api.exoclick.com/v2/user",
  rollerads: "https://api.rollerads.com/v1/user",
  zeydoo: "https://api.zeydoo.com/v1/user",
  propush: "https://api.propush.me/v1/user",
};

export async function POST(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const body = await request.json();
    const { networkId } = body;

    if (!networkId || !isValidNetworkId(networkId)) {
      return NextResponse.json({ error: "Invalid or missing networkId" }, { status: 400 });
    }

    const keyDoc = await adminDb
      .collection("users")
      .doc(uid)
      .collection("apiKeys")
      .doc(networkId)
      .get();

    if (!keyDoc.exists || !keyDoc.data()?.encryptedKey) {
      return NextResponse.json({ error: "API key not found for this network" }, { status: 404 });
    }

    const decryptedKey = decrypt(keyDoc.data()!.encryptedKey);
    const testUrl = NETWORK_TEST_URLS[networkId];

    try {
      await axios.get(testUrl, {
        headers: { Authorization: `Bearer ${decryptedKey}` },
        timeout: 10000,
      });
      return NextResponse.json({ success: true, networkId, status: "connected" });
    } catch {
      return NextResponse.json({ success: false, networkId, status: "failed", error: "Connection test failed" });
    }
  } catch (error) {
    console.error("POST /api/networks/config/test-connection error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
