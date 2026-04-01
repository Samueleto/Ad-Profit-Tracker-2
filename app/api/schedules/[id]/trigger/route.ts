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
    const doc = await adminDb.collection("schedules").doc(id).get();

    if (!doc.exists || doc.data()?.uid !== uid) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    const schedule = doc.data()!;
    const networkId = schedule.networkId;

    if (!networkId || !isValidNetworkId(networkId)) {
      return NextResponse.json({ error: "Schedule has no valid networkId" }, { status: 400 });
    }

    const apiKey = await getApiKey(uid, networkId);
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 400 });
    }

    const syncRef = await adminDb.collection("syncJobs").add({
      uid,
      networkId,
      scheduleId: id,
      status: "pending",
      triggeredBy: "manual_trigger",
      createdAt: FieldValue.serverTimestamp(),
    });

    await doc.ref.update({ lastRun: FieldValue.serverTimestamp() });

    await createAuditLog(uid, "schedule_triggered", networkId, {
      scheduleId: id,
      jobId: syncRef.id,
    });

    return NextResponse.json({ success: true, jobId: syncRef.id });
  } catch (error) {
    console.error("POST /api/schedules/[id]/trigger error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
