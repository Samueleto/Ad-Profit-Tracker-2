import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const { id } = await params;
    const doc = await adminDb.collection("syncJobs").doc(id).get();

    if (!doc.exists || doc.data()?.uid !== uid) {
      return NextResponse.json({ error: "Sync job not found" }, { status: 404 });
    }

    if (doc.data()?.status !== "pending") {
      return NextResponse.json({ error: "Only pending jobs can be cancelled" }, { status: 400 });
    }

    await doc.ref.update({
      status: "cancelled",
      cancelledAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/sync-status/[id]/cancel error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
