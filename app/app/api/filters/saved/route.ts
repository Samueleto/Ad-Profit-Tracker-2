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
    const snapshot = await adminDb
      .collection("savedFilters")
      .where("uid", "==", uid)
      .orderBy("createdAt", "desc")
      .get();

    return NextResponse.json({ filters: snapshot.docs.map(serializeDoc) });
  } catch (error) {
    console.error("GET /api/filters/saved error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const body = await request.json();
    const { name, filters } = body;

    if (!name || !filters) {
      return NextResponse.json({ error: "name and filters are required" }, { status: 400 });
    }

    const ref = await adminDb.collection("savedFilters").add({
      uid,
      name,
      filters,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const doc = await ref.get();
    return NextResponse.json({ filter: serializeDoc(doc) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/filters/saved error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
