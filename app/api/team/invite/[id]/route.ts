import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const { id } = await params;
    const doc = await adminDb.collection("teamInvites").doc(id).get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    // Only the inviter or the team owner can cancel
    if (doc.data()?.invitedBy !== uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await doc.ref.update({
      status: "cancelled",
      cancelledAt: FieldValue.serverTimestamp(),
      cancelledBy: uid,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/team/invite/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
