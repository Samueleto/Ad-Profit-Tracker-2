import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { SUPPORTED_NETWORKS } from "@/lib/constants";

// In-memory rate limit: 3 sync-all requests per hour per uid
const syncAllRateLimit = new Map<string, { count: number; resetAt: number }>();

function checkSyncAllRateLimit(uid: string): boolean {
  const now = Date.now();
  const entry = syncAllRateLimit.get(uid);
  if (!entry || now >= entry.resetAt) {
    syncAllRateLimit.set(uid, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 3) return false;
  entry.count++;
  return true;
}

export async function POST(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  if (!checkSyncAllRateLimit(uid)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Maximum 3 sync-all requests per hour." },
      { status: 429 }
    );
  }

  try {
    const results: Record<string, string> = {};

    for (const networkId of SUPPORTED_NETWORKS) {
      const keyDoc = await adminDb
        .collection("users")
        .doc(uid)
        .collection("apiKeys")
        .doc(networkId)
        .get();

      if (!keyDoc.exists || !keyDoc.data()?.encryptedKey) {
        results[networkId] = "skipped: no api key";
        continue;
      }

      const syncRef = adminDb.collection("syncJobs").doc();
      await syncRef.set({
        uid,
        networkId,
        status: "pending",
        createdAt: FieldValue.serverTimestamp(),
        triggeredBy: "manual",
      });

      // Create audit log
      await adminDb.collection("auditLogs").add({
        userId: uid,
        action: "sync_triggered",
        networkId,
        jobId: syncRef.id,
        createdAt: FieldValue.serverTimestamp(),
      });

      results[networkId] = "queued";
    }

    const triggered = Object.values(results).filter(v => v === "queued").length;
    const skipped = Object.values(results).filter(v => v.startsWith("skipped")).length;
    const failed = Object.values(results).filter(v => v.startsWith("error")).length;

    return NextResponse.json({ success: true, results, triggered, skipped, failed });
  } catch (error) {
    console.error("POST /api/networks/sync-all error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
