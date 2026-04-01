import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";

// In-memory rate limit: 20 resolve operations per hour per uid
const resolveRateLimit = new Map<string, { count: number; resetAt: number }>();

export async function PATCH(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  // Rate limit: 20 resolve operations per hour
  const now = Date.now();
  const entry = resolveRateLimit.get(uid);
  if (entry && now < entry.resetAt && entry.count >= 20) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      { error: "Rate limit exceeded. Maximum 20 resolve operations per hour." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }
  if (!entry || now >= entry.resetAt) {
    resolveRateLimit.set(uid, { count: 1, resetAt: now + 60 * 60 * 1000 });
  } else {
    entry.count++;
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { docIds, resolution } = body as { docIds?: unknown; resolution?: string };

    if (!Array.isArray(docIds) || docIds.length === 0) {
      return NextResponse.json({ error: "docIds must be a non-empty array" }, { status: 400 });
    }

    if (!resolution || typeof resolution !== "string") {
      return NextResponse.json({ error: "resolution is required" }, { status: 400 });
    }

    // Limit batch size to prevent abuse
    const ids = (docIds as unknown[]).filter((id) => typeof id === "string").slice(0, 100) as string[];

    let resolvedCount = 0;
    let skippedCount = 0;

    const batch = adminDb.batch();

    for (const docId of ids) {
      const doc = await adminDb.collection("adStats").doc(docId).get();

      if (!doc.exists) {
        skippedCount++;
        continue;
      }

      // Silently skip documents that don't belong to this user
      if (doc.data()?.uid !== uid) {
        skippedCount++;
        continue;
      }

      batch.update(doc.ref, {
        validationStatus: "resolved",
        isReconciled: true,
        reconciledAt: FieldValue.serverTimestamp(),
        resolution,
      });
      resolvedCount++;
    }

    if (resolvedCount > 0) await batch.commit();

    return NextResponse.json({
      success: true,
      resolvedCount,
      skippedCount,
    });
  } catch (error) {
    console.error("PATCH /api/reconciliation/resolve error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
