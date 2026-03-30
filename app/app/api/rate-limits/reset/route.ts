import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { isValidNetworkId } from "@/lib/constants";

// Startup check — loud warning if INTERNAL_SYNC_SECRET is missing in production
if (process.env.NODE_ENV === "production" && !process.env.INTERNAL_SYNC_SECRET) {
  console.error(
    "FATAL: INTERNAL_SYNC_SECRET is not set. " +
    "POST /api/rate-limits/reset internal-secret auth will always fail."
  );
}

// In-memory rate limit for user-authenticated resets: 10/hour per uid
const userResetRateLimit = new Map<string, { count: number; resetAt: number }>();
const USER_RESET_MAX = 10;
const USER_RESET_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkUserResetLimit(uid: string): boolean {
  const now = Date.now();
  const entry = userResetRateLimit.get(uid);
  if (!entry || now >= entry.resetAt) {
    userResetRateLimit.set(uid, { count: 1, resetAt: now + USER_RESET_WINDOW_MS });
    return true;
  }
  if (entry.count >= USER_RESET_MAX) return false;
  entry.count++;
  return true;
}

export async function POST(request: Request) {
  // --- Dual auth: Bearer token first, then x-internal-secret ---
  const authHeader = request.headers.get("authorization") || "";
  const internalSecret = process.env.INTERNAL_SYNC_SECRET;

  let uid: string | null = null;
  let isInternalCall = false;

  if (authHeader.startsWith("Bearer ")) {
    // User-facing call: verify Firebase ID token
    const authResult = await verifyAuthToken(request);
    if ("error" in authResult) return authResult.error;
    uid = authResult.token.uid;
  } else {
    // Internal call: verify x-internal-secret
    if (!internalSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const provided = request.headers.get("x-internal-secret");
    if (!provided || provided !== internalSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    isInternalCall = true;
  }

  // Rate limit user-authenticated calls (not internal)
  if (!isInternalCall && uid) {
    if (!checkUserResetLimit(uid)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Maximum 10 resets per hour." },
        { status: 429 }
      );
    }
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { networkId, userId: bodyUserId } = body as {
      networkId?: string;
      userId?: string;
      [key: string]: unknown;
    };

    // Guard: never reset circuit breaker state — that belongs to /api/errors/circuit-breaker/reset
    if ("circuitBreaker" in body || "resetCircuitBreaker" in body) {
      return NextResponse.json(
        { error: "Circuit breaker state cannot be reset from this endpoint" },
        { status: 400 }
      );
    }

    // For user calls: uid always comes from the verified token, ignore any userId in the body
    // For internal calls: a userId may be provided in the body to scope the reset
    const targetUid = isInternalCall
      ? (typeof bodyUserId === "string" && bodyUserId ? bodyUserId : null)
      : uid!;

    let query = adminDb
      .collection("rateLimitLogs")
      .limit(500) as FirebaseFirestore.Query;

    if (targetUid) {
      query = query.where("uid", "==", targetUid);
    }

    if (networkId && isValidNetworkId(networkId)) {
      query = query.where("networkId", "==", networkId);
    }

    const snapshot = await query.get();
    const batch = adminDb.batch();
    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();

    // Audit log only for user-authenticated calls
    if (!isInternalCall && uid) {
      adminDb.collection("auditLogs").add({
        userId: uid,
        action: "rate_limit_reset",
        networkId: networkId ?? null,
        details: { cleared: snapshot.size },
        createdAt: FieldValue.serverTimestamp(),
      }).catch((err) => console.error("Audit log write failed:", err));
    }

    return NextResponse.json({ success: true, cleared: snapshot.size });
  } catch (error) {
    console.error("POST /api/rate-limits/reset error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
