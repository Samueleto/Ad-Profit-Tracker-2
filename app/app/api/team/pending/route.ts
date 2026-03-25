import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { serializeDoc } from "@/lib/networks/network-helpers";

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const snapshot = await adminDb
      .collection("teamInvites")
      .where("invitedBy", "==", uid)
      .where("status", "==", "pending")
      .orderBy("createdAt", "desc")
      .get();

    const invites = snapshot.docs.map(serializeDoc);
    return NextResponse.json({ invites, total: invites.length });
  } catch (error) {
    console.error("GET /api/team/pending error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
