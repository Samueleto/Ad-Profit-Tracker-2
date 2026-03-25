import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { serializeDoc } from "@/lib/networks/network-helpers";

export async function GET(
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

    return NextResponse.json({ error: serializeDoc(doc) });
  } catch (error) {
    console.error("GET /api/errors/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
