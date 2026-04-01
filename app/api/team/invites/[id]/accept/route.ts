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
  const email = authResult.token.email;

  try {
    const { id } = await params;
    const doc = await adminDb.collection("teamInvites").doc(id).get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    const invite = doc.data()!;

    if (invite.email !== email) {
      return NextResponse.json({ error: "This invite was not sent to you" }, { status: 403 });
    }

    if (invite.status !== "pending") {
      return NextResponse.json({ error: "This invite is no longer pending" }, { status: 400 });
    }

    // Check not expired
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      return NextResponse.json({ error: "This invite has expired" }, { status: 400 });
    }

    // Add as team member
    const memberRef = await adminDb.collection("teamMembers").add({
      uid,
      email,
      role: invite.role,
      teamOwnerId: invite.invitedBy,
      teamId: invite.teamId || invite.invitedBy,
      inviteId: id,
      joinedAt: FieldValue.serverTimestamp(),
    });

    // Update invite status
    await doc.ref.update({
      status: "accepted",
      acceptedAt: FieldValue.serverTimestamp(),
      acceptedBy: uid,
    });

    return NextResponse.json({ success: true, memberId: memberRef.id });
  } catch (error) {
    console.error("POST /api/team/invites/[id]/accept error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
