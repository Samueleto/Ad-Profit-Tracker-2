import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { encrypt } from "@/lib/encryption";
import { isValidNetworkId } from "@/lib/constants";

// In-memory rate limit: 5 saves per minute per uid
const saveRateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkSaveRateLimit(uid: string): boolean {
  const now = Date.now();
  const entry = saveRateLimit.get(uid);
  if (!entry || now >= entry.resetAt) {
    saveRateLimit.set(uid, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

export async function POST(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;

  const { token } = authResult;
  const uid = token.uid;

  // Rate limit check before any body parsing or Firestore work
  if (!checkSaveRateLimit(uid)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Maximum 5 key saves per minute." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { networkId, key } = body;

    if (!networkId || !isValidNetworkId(networkId)) {
      return NextResponse.json(
        { error: "Invalid networkId. Must be one of: exoclick, rollerads, zeydoo, propush" },
        { status: 400 }
      );
    }

    if (!key || typeof key !== "string" || key.trim() === "") {
      return NextResponse.json({ error: "key is required and cannot be empty" }, { status: 400 });
    }

    // Encrypt server-side — raw key never logged or stored in plaintext
    const encryptedKey = encrypt(key.trim());

    const docRef = adminDb.collection("users").doc(uid).collection("apiKeys").doc(networkId);
    const existing = await docRef.get();

    if (existing.exists) {
      await docRef.update({
        encryptedKey,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      await docRef.set({
        userId: uid,
        networkId,
        encryptedKey,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({ networkId, status: "connected" });
  } catch (error) {
    console.error("keys/save error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
