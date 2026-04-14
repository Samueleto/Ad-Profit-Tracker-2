import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { serializeDoc } from "@/lib/networks/network-helpers";

/**
 * GET /api/team/invitations
 *
 * Two modes depending on query param:
 *   - Default (no ?received): returns invitations the current user SENT
 *     (for admins/owners managing their workspace). Queries teamInvitations
 *     where invitedByUid == uid.
 *   - ?received=true: returns invitations the current user RECEIVED
 *     (by email). Queries teamInvites by email for backward compat.
 */
export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;
  const email = authResult.token.email;

  const { searchParams } = new URL(request.url);
  const received = searchParams.get("received") === "true";

  try {
    if (received) {
      // Invitations received by this user — backward-compat path
      if (!email) {
        return NextResponse.json({ invites: [], invitations: [] });
      }
      const snap = await adminDb
        .collection("teamInvites")
        .where("email", "==", email)
        .where("status", "==", "pending")
        .orderBy("createdAt", "desc")
        .get();
      const invites = snap.docs.map(serializeDoc);
      return NextResponse.json({ invites, invitations: invites });
    }

    // Invitations sent by this user — for workspace admin management view
    const snap = await adminDb
      .collection("teamInvitations")
      .where("invitedByUid", "==", uid)
      .where("status", "==", "pending")
      .orderBy("createdAt", "desc")
      .get();

    // Strip token and tokenHash — return only WorkspaceInvitationSafe fields
    const invitations = snap.docs.map((doc) => {
      const d = serializeDoc(doc) as Record<string, unknown>;
      const { token: _t, tokenHash: _h, ...safe } = d;
      return safe;
    });

    return NextResponse.json({ invitations });
  } catch (error) {
    console.error("GET /api/team/invitations error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
