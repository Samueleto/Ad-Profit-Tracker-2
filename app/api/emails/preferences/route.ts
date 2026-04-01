import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { serializeDoc } from "@/lib/networks/network-helpers";

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const doc = await adminDb.collection("emailPreferences").doc(uid).get();

    if (!doc.exists) {
      return NextResponse.json({
        preferences: {
          syncCompleted: true,
          syncFailed: true,
          weeklyReport: true,
          roiAlerts: true,
          teamInvitations: true,
          marketingEmails: false,
        },
      });
    }

    return NextResponse.json({ preferences: serializeDoc(doc) });
  } catch (error) {
    console.error("GET /api/emails/preferences error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const body = await request.json();
    const allowed = ["syncCompleted", "syncFailed", "weeklyReport", "roiAlerts", "teamInvitations", "marketingEmails"];
    const updates: Record<string, unknown> = { uid, updatedAt: FieldValue.serverTimestamp() };

    for (const key of allowed) {
      if (key in body) updates[key] = Boolean(body[key]);
    }

    await adminDb.collection("emailPreferences").doc(uid).set(updates, { merge: true });

    return NextResponse.json({ success: true, preferences: updates });
  } catch (error) {
    console.error("PATCH /api/emails/preferences error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
