import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";

// In-memory rate limit: 15 invalidations per hour per uid
const invalidateRateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 15;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkInvalidateRateLimit(uid: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = invalidateRateLimit.get(uid);
  if (!entry || now >= entry.resetAt) {
    invalidateRateLimit.set(uid, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  return { allowed: true, retryAfterSeconds: 0 };
}

export async function POST(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  const { allowed, retryAfterSeconds } = checkInvalidateRateLimit(uid);
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Maximum 15 cache invalidations per hour." },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfterSeconds) },
      }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const rawKeys: unknown = (body as Record<string, unknown>).keys;
    const uidPrefix = `${uid}_`;

    // Only accept keys that are namespaced to the authenticated user's UID.
    // Any key that doesn't start with `{uid}_` is silently dropped.
    const safeKeys: string[] = Array.isArray(rawKeys)
      ? (rawKeys as unknown[]).filter(
          (k): k is string => typeof k === "string" && k.startsWith(uidPrefix)
        )
      : [];

    // Delete the matching rawResponses documents (cache backing store)
    let invalidated = 0;
    if (safeKeys.length > 0) {
      const batch = adminDb.batch();
      for (const key of safeKeys.slice(0, 50)) {
        // Strip uid prefix to get networkId segment for rawResponses lookup
        const docId = key.slice(uidPrefix.length).split("_")[0];
        if (docId) {
          const ref = adminDb
            .collection("users")
            .doc(uid)
            .collection("rawResponses")
            .doc(docId);
          batch.delete(ref);
          invalidated++;
        }
      }
      await batch.commit();
    }

    // Fire-and-forget audit log
    adminDb.collection("auditLogs").add({
      userId: uid,
      action: "cache_invalidated",
      details: { keysRequested: safeKeys.length, invalidated },
      createdAt: FieldValue.serverTimestamp(),
    }).catch((err) => console.error("Audit log write failed:", err));

    return NextResponse.json({ invalidated: true, keysInvalidated: invalidated });
  } catch (error) {
    console.error("POST /api/cache/invalidate error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
