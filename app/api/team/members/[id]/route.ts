import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";

/**
 * DELETE /api/team/members/[id]
 *
 * [id] is the target user's Firebase Auth UID (matches what GET /api/team/members
 * returns as `uid`). Removes the user from the workspace by clearing their
 * workspaceId and workspaceRole fields.
 *
 * Authorization:
 *   - Any member can remove themselves (self-leave).
 *   - Workspace owner and admins can remove other members.
 *   - The workspace owner cannot be removed (must transfer ownership first).
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const requesterUid = authResult.token.uid;

  const { id: targetUid } = await params;

  try {
    const [requesterDoc, targetDoc] = await Promise.all([
      adminDb.collection("users").doc(requesterUid).get(),
      adminDb.collection("users").doc(targetUid).get(),
    ]);

    if (!targetDoc.exists) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const targetData = targetDoc.data()!;
    const isSelf = requesterUid === targetUid;

    if (!isSelf) {
      // Requester must be in the same workspace and be owner or admin
      if (!requesterDoc.exists) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const requesterData = requesterDoc.data()!;

      if (
        !requesterData.workspaceId ||
        requesterData.workspaceId !== targetData.workspaceId
      ) {
        return NextResponse.json({ error: "Target is not in your workspace" }, { status: 403 });
      }

      const wsDoc = await adminDb
        .collection("workspaces")
        .doc(requesterData.workspaceId as string)
        .get();
      const isOwner = wsDoc.exists && wsDoc.data()?.ownerUid === requesterUid;
      const isAdmin = requesterData.workspaceRole === "admin";

      if (!isOwner && !isAdmin) {
        return NextResponse.json({ error: "Only workspace owners and admins can remove members" }, { status: 403 });
      }

      // Workspace owner cannot be removed
      const targetIsOwner = wsDoc.exists && wsDoc.data()?.ownerUid === targetUid;
      if (targetIsOwner) {
        return NextResponse.json(
          { error: "Cannot remove the workspace owner. Transfer ownership first." },
          { status: 422 }
        );
      }
    }

    // Clear workspace membership from the target user
    await targetDoc.ref.update({
      workspaceId: FieldValue.delete(),
      workspaceRole: FieldValue.delete(),
      workspaceJoinedAt: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/team/members/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/team/members/[id]
 * Legacy endpoint — role changes now go through /api/team/members/[id]/role.
 * Kept for backward compatibility; updates role on the user doc.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const requesterUid = authResult.token.uid;

  const { id: targetUid } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { role } = body;
  const VALID_ROLES = new Set(["admin", "member"]);
  if (!role || typeof role !== "string" || !VALID_ROLES.has(role)) {
    return NextResponse.json({ error: "role must be admin or member" }, { status: 400 });
  }

  try {
    const [requesterDoc, targetDoc] = await Promise.all([
      adminDb.collection("users").doc(requesterUid).get(),
      adminDb.collection("users").doc(targetUid).get(),
    ]);

    if (!requesterDoc.exists || !targetDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const requesterData = requesterDoc.data()!;
    const targetData = targetDoc.data()!;

    if (requesterData.workspaceId !== targetData.workspaceId) {
      return NextResponse.json({ error: "Target is not in your workspace" }, { status: 403 });
    }

    const wsDoc = await adminDb
      .collection("workspaces")
      .doc(requesterData.workspaceId as string)
      .get();
    const isOwner = wsDoc.exists && wsDoc.data()?.ownerUid === requesterUid;
    if (!isOwner && requesterData.workspaceRole !== "admin") {
      return NextResponse.json({ error: "Only owners and admins can change roles" }, { status: 403 });
    }

    await targetDoc.ref.update({ workspaceRole: role, updatedAt: FieldValue.serverTimestamp() });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/team/members/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
