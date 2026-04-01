import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { serializeDoc } from "@/lib/networks/network-helpers";

const VALID_ROLES = ["admin", "editor", "viewer"];

export async function POST(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const body = await request.json();
    const { email, role = "viewer", teamId } = body;

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: `role must be one of: ${VALID_ROLES.join(", ")}` }, { status: 400 });
    }

    // Check if already invited
    const existingInvite = await adminDb
      .collection("teamInvites")
      .where("email", "==", email)
      .where("invitedBy", "==", uid)
      .where("status", "==", "pending")
      .get();

    if (!existingInvite.empty) {
      return NextResponse.json({ error: "An invite has already been sent to this email" }, { status: 409 });
    }

    const inviteRef = await adminDb.collection("teamInvites").add({
      email,
      role,
      teamId: teamId || uid,
      invitedBy: uid,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    });

    const doc = await inviteRef.get();
    return NextResponse.json({ invite: serializeDoc(doc) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/team/invite error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
