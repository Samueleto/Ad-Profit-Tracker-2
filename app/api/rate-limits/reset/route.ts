import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { isValidNetworkId } from "@/lib/constants";

// Startup check
if (process.env.NODE_ENV === "production" && !process.env.INTERNAL_SYNC_SECRET) {
  console.error(
    "FATAL: INTERNAL_SYNC_SECRET is not set. " +
    "POST /api/rate-limits/reset internal-secret auth will always fail."
  );
}

// In-memory rate limit: 10 resets/hour per uid
const userResetRateLimit = new Map<string, { count: number; resetAt: number }>();
const USER_RESET_MAX = 10;
const USER_RESET_WINDOW_MS = 60 * 60 * 1000;

function checkUserResetLimit(uid: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = userResetRateLimit.get(uid);
  if (!entry || now >= entry.resetAt) {
    userResetRateLimit.set(uid, { count: 1, resetAt: now + USER_RESET_WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (entry.count >= USER_RESET_MAX) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  return { allowed: true, retryAfterSeconds: 0 };
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const internalSecret = process.env.INTERNAL_SYNC_SECRET;

  let uid: string | null = null;
  let isInternalCall = false;

  if (authHeader.startsWith("Bearer ")) {
    const authResult = await verifyAuthToken(request);
    if ("error" in authResult) return authResult.error;
    uid = authResult.token.uid;
  } else {
    if (!internalSecret) {
      return NextResponse.json({ code: "UNAUTHENTICATED", message: "Unauthorized" }, { status: 401 });
    }
    const provided = request.headers.get("x-internal-secret");
    if (!provided || provided !== internalSecret) {
      return NextResponse.json({ code: "UNAUTHENTICATED", message: "Unauthorized" }, { status: 401 });
    }
    isInternalCall = true;
  }

  if (!isInternalCall && uid) {
    const { allowed, retryAfterSeconds } = checkUserResetLimit(uid);
    if (!allowed) {
      return NextResponse.json(
        {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Rate limit exceeded. Maximum 10 resets per hour.",
          retryAfterSeconds,
        },
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

    if ("circuitBreaker" in body || "resetCircuitBreaker" in body) {
      return NextResponse.json(
        { code: "INVALID_REQUEST", message: "Circuit breaker state cannot be reset from this endpoint" },
        { status: 400 }
      );
    }

    const targetUid = isInternalCall
      ? (typeof bodyUserId === "string" && bodyUserId ? bodyUserId : null)
      : uid!;

    let query = adminDb.collection("rateLimitLogs").limit(500) as FirebaseFirestore.Query;
    if (targetUid) query = query.where("uid", "==", targetUid);
    if (networkId && isValidNetworkId(networkId)) query = query.where("networkId", "==", networkId);

    const snapshot = await query.get();
    const batch = adminDb.batch();
    for (const doc of snapshot.docs) batch.delete(doc.ref);
    await batch.commit();

    // Audit log — failure must not fail the request
    let auditLogWarning: string | undefined;
    if (!isInternalCall && uid) {
      try {
        await adminDb.collection("auditLogs").add({
          userId: uid,
          action: "rate_limit_reset",
          networkId: networkId ?? null,
          details: { cleared: snapshot.size },
          createdAt: FieldValue.serverTimestamp(),
        });
      } catch (auditErr) {
        console.error("Audit log write failed:", auditErr);
        auditLogWarning = "Audit log write failed";
      }
    }

    return NextResponse.json({
      success: true,
      cleared: snapshot.size,
      ...(auditLogWarning ? { auditLogWarning } : {}),
    });
  } catch (error) {
    console.error("POST /api/rate-limits/reset error:", error);
    return NextResponse.json(
      { code: "FIRESTORE_READ_FAILURE", message: "Rate limit service temporarily unavailable. Please try again." },
      { status: 500 }
    );
  }
}
