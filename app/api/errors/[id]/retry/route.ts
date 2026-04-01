import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { isValidNetworkId } from "@/lib/constants";
import { getApiKey, createAuditLog } from "@/lib/networks/network-helpers";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const { id } = await params;
    const doc = await adminDb.collection("syncErrors").doc(id).get();

    if (!doc.exists || doc.data()?.uid !== uid) {
      return NextResponse.json({ error: "Error not found" }, { status: 404 });
    }

    const errorData = doc.data()!;
    const networkId = errorData.networkId;

    if (!networkId || !isValidNetworkId(networkId)) {
      return NextResponse.json({ error: "Cannot retry: no valid networkId" }, { status: 400 });
    }

    const apiKey = await getApiKey(uid, networkId);
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 400 });
    }

    const syncRef = await adminDb.collection("syncJobs").add({
      uid,
      networkId,
      status: "pending",
      triggeredBy: "retry",
      errorId: id,
      createdAt: FieldValue.serverTimestamp(),
    });

    await doc.ref.update({
      status: "retrying",
      retryJobId: syncRef.id,
      retriedAt: FieldValue.serverTimestamp(),
    });

    await createAuditLog(uid, "error_retried", networkId, { errorId: id, jobId: syncRef.id });

    return NextResponse.json({ success: true, jobId: syncRef.id });
  } catch (error) {
    console.error("POST /api/errors/[id]/retry error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
