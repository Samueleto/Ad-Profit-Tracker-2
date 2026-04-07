import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { SUPPORTED_NETWORKS } from "@/lib/constants";
import { serializeDoc } from "@/lib/networks/network-helpers";

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const statuses: Record<string, unknown> = {};

    for (const networkId of SUPPORTED_NETWORKS) {
      const logsSnapshot = await adminDb
        .collection("auditLogs")
        .where("userId", "==", uid)
        .where("networkId", "==", networkId)
        .where("action", "in", ["sync_completed", "sync_failed"])
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();

      const keyDoc = await adminDb
        .collection("users")
        .doc(uid)
        .collection("apiKeys")
        .doc(networkId)
        .get();

      const lastSync = logsSnapshot.empty ? null : serializeDoc(logsSnapshot.docs[0]);
      statuses[networkId] = {
        networkId,
        hasApiKey: keyDoc.exists && !!keyDoc.data()?.encryptedKey,
        lastSync,
        status: lastSync ? (lastSync as Record<string, unknown>).action === "sync_completed" ? "ok" : "error" : "never",
      };
    }

    return NextResponse.json({ statuses });
  } catch (error) {
    console.error("GET /api/sync-status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
