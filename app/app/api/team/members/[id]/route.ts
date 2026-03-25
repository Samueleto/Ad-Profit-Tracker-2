import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";

const VALID_ROLES = ["admin", "editor", "viewer"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const { id } = await params;
    const doc = await adminDb.collection("teamMembers").doc(id).get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Team member not found" }, { status: 404 });
    }

    // Check requester is admin
    const memberData = doc.data()!;
    if (memberData.teamOwnerId !== uid && memberData.uid !== uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { role } = body;

    if (!role || !VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: `role must be one of: ${VALID_ROLES.join(", ")}` }, { status: 400 });
    }

    await doc.ref.update({ role, updatedAt: FieldValue.serverTimestamp() });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/team/members/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const { id } = await params;
    const doc = await adminDb.collection("teamMembers").doc(id).get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Team member not found" }, { status: 404 });
    }

    const memberData = doc.data()!;
    // Only owner or the member themselves can remove
    if (memberData.teamOwnerId !== uid && memberData.uid !== uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await doc.ref.delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/team/members/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
