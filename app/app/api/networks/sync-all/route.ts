import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { SUPPORTED_NETWORKS } from "@/lib/constants";

export async function POST(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

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
        uid,
        action: "sync_triggered",
        networkId,
        jobId: syncRef.id,
        timestamp: FieldValue.serverTimestamp(),
      });

      results[networkId] = "queued";
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("POST /api/networks/sync-all error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
