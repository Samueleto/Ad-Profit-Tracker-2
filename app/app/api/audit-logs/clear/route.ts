import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";

// In-memory rate limit: 3 clears per day per uid
const clearRateLimit = new Map<string, { count: number; resetAt: number }>();
const CLEAR_MAX = 3;
const CLEAR_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function DELETE(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  // Rate limit check
  const now = Date.now();
  const entry = clearRateLimit.get(uid);
  if (entry && now < entry.resetAt && entry.count >= CLEAR_MAX) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      { error: "Rate limit exceeded. Maximum 3 log clears per day." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }
  if (!entry || now >= entry.resetAt) {
    clearRateLimit.set(uid, { count: 1, resetAt: now + CLEAR_WINDOW_MS });
  } else {
    entry.count++;
  }

  try {
    const { searchParams } = new URL(request.url);
    const networkId = searchParams.get("networkId"); // optional scope

    // Build query — uid always from verified token
    let query = adminDb
      .collection("auditLogs")
      .where("userId", "==", uid) as FirebaseFirestore.Query;

    if (networkId) {
      query = query.where("networkId", "==", networkId);
    }

    // Delete in batches of 500 (Firestore batch limit)
    let deletedCount = 0;
    let snapshot = await query.limit(500).get();

    while (!snapshot.empty) {
      const batch = adminDb.batch();
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      deletedCount += snapshot.size;
      if (snapshot.size < 500) break;
      snapshot = await query.limit(500).get();
    }

    // Write final audit entry directly via Admin SDK — NOT via POST /api/audit-logs
    // to avoid recursion. This entry records that logs were cleared.
    await adminDb.collection("auditLogs").add({
      userId: uid,
      action: "audit_logs_cleared",
      networkId: networkId || null,
      metadata: { deletedCount, scope: networkId ? `networkId:${networkId}` : "all" },
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, deletedCount });
  } catch (error) {
    console.error("DELETE /api/audit-logs/clear error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
