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

  try {
    const { id } = await params;
    const doc = await adminDb.collection("syncErrors").doc(id).get();

    if (!doc.exists || doc.data()?.uid !== uid) {
      return NextResponse.json({ error: "Error not found" }, { status: 404 });
    }

    await doc.ref.update({
      status: "dismissed",
      dismissedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/errors/[id]/dismiss error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
