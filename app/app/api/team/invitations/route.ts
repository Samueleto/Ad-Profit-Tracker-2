import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { serializeDoc } from "@/lib/networks/network-helpers";

// GET pending invites for the current user (by their email)
export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const email = authResult.token.email;

  if (!email) {
    return NextResponse.json({ error: "User has no email" }, { status: 400 });
  }

  try {
    const snapshot = await adminDb
      .collection("teamInvites")
      .where("email", "==", email)
      .where("status", "==", "pending")
      .orderBy("createdAt", "desc")
      .get();

    const invites = snapshot.docs.map(serializeDoc);
    return NextResponse.json({ invites });
  } catch (error) {
    console.error("GET /api/team/invitations error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
