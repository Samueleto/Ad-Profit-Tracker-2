import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";

export async function POST(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const body = await request.json().catch(() => ({}));
    const { type = "info", message = "This is a test notification" } = body;

    const ref = await adminDb.collection("notifications").add({
      uid,
      type,
      title: "Test Notification",
      message,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, id: ref.id });
  } catch (error) {
    console.error("POST /api/notifications/test error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
