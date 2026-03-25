import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const { id } = await params;
    const doc = await adminDb.collection("savedFilters").doc(id).get();

    if (!doc.exists || doc.data()?.uid !== uid) {
      return NextResponse.json({ error: "Filter not found" }, { status: 404 });
    }

    await doc.ref.delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/filters/saved/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
