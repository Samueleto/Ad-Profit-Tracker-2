import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";

/**
 * DELETE /api/team/invitations/[id]
 * Revoke a pending invitation. Only the sender (invitedByUid) or a workspace
 * owner/admin may revoke.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  const { id } = await params;

  try {
    const doc = await adminDb.collection("teamInvitations").doc(id).get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    const inv = doc.data()!;

    // Only the sender or a workspace owner/admin may revoke
    if (inv.invitedByUid !== uid) {
      // Check if requester is workspace owner or admin
      const userDoc = await adminDb.collection("users").doc(uid).get();
      if (!userDoc.exists) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const userData = userDoc.data()!;
      const isOwnerOrAdmin =
        userData.workspaceRole === "admin" ||
        (inv.workspaceId &&
          userData.workspaceId === inv.workspaceId);

      if (!isOwnerOrAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    if (inv.status !== "pending") {
      // Idempotent: already revoked/used — treat as success
      return NextResponse.json({ success: true });
    }

    await doc.ref.update({
      status: "revoked",
      revokedAt: FieldValue.serverTimestamp(),
      revokedByUid: uid,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/team/invitations/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
