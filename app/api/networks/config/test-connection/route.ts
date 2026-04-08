import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
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

// In-memory rate limit: 10 connection tests per hour per uid
const testRateLimit = new Map<string, { count: number; resetAt: number }>();

function checkTestRateLimit(uid: string): boolean {
  const now = Date.now();
  const entry = testRateLimit.get(uid);
  if (!entry || now >= entry.resetAt) {
    testRateLimit.set(uid, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

export async function POST(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  if (!checkTestRateLimit(uid)) {
    const entry = testRateLimit.get(uid);
    const retryAfter = entry ? Math.ceil((entry.resetAt - Date.now()) / 1000) : 3600;
    return NextResponse.json(
      { error: "Rate limit exceeded. Maximum 10 connection tests per hour." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

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

    let connected = false;
    try {
      await axios.get(testUrl, {
        headers: { Authorization: `Bearer ${decryptedKey}` },
        timeout: 10000,
      });
      connected = true;
    } catch {
      connected = false;
    }

    // Audit log — fire-and-forget, never includes the decrypted key
    adminDb.collection("auditLogs").add({
      userId: uid,
      action: "connection_test",
      networkId,
      details: { status: connected ? "connected" : "failed" },
      createdAt: FieldValue.serverTimestamp(),
    }).catch((err: Error) => console.error("Audit log write failed:", err));

    if (connected) {
      return NextResponse.json({ success: true, networkId, status: "connected" });
    }
    return NextResponse.json(
      { success: false, networkId, status: "failed", message: "Connection test failed — network API unreachable" },
      { status: 502 }
    );
  } catch (error) {
    console.error("POST /api/networks/config/test-connection error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
