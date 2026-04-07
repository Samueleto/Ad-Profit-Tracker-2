import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { isValidNetworkId } from "@/lib/constants";

// In-memory rate limit: 10 resets per hour per uid
const resetRateLimit = new Map<string, { count: number; resetAt: number }>();

export async function POST(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  // Rate limit: 10 resets per hour
  const now = Date.now();
  const entry = resetRateLimit.get(uid);
  if (entry && now < entry.resetAt && entry.count >= 10) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      { error: "Rate limit exceeded. Maximum 10 circuit breaker resets per hour." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }
  if (!entry || now >= entry.resetAt) {
    resetRateLimit.set(uid, { count: 1, resetAt: now + 60 * 60 * 1000 });
  } else {
    entry.count++;
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { networkId } = body as { networkId?: string };

    if (!networkId || !isValidNetworkId(networkId)) {
      return NextResponse.json({ error: "Valid networkId is required" }, { status: 400 });
    }

    // Direct subcollection lookup — ownership guaranteed by uid path
    const configRef = adminDb.collection("users").doc(uid).collection("networkConfigs").doc(networkId);
    const configDoc = await configRef.get();

    if (!configDoc.exists) {
      return NextResponse.json({ error: "Network config not found" }, { status: 404 });
    }

    await configRef.update({
      circuitBreakerState: "closed",
      failureCount: 0,
      lastFailureAt: null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Audit log — fire-and-forget
    adminDb.collection("auditLogs").add({
      userId: uid,
      action: "circuit_breaker_reset",
      networkId,
      metadata: { previousState: configDoc.data()?.circuitBreakerState || "unknown" },
      createdAt: FieldValue.serverTimestamp(),
    }).catch((err: Error) => console.error("Audit log write failed:", err));

    return NextResponse.json({ success: true, networkId, circuitBreakerState: "closed" });
  } catch (error) {
    console.error("POST /api/errors/circuit-breaker/reset error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
