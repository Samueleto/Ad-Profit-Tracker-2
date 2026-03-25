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
      .collection("reconciliationRules")
      .where("uid", "==", uid)
      .orderBy("createdAt", "desc")
      .get();

    const rules = snapshot.docs.map(serializeDoc);
    return NextResponse.json({ rules });
  } catch (error) {
    console.error("GET /api/reconciliation/rules error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const body = await request.json();
    const { name, condition, adjustment, networkId, enabled = true } = body;

    if (!name || !condition) {
      return NextResponse.json({ error: "name and condition are required" }, { status: 400 });
    }

    const ref = await adminDb.collection("reconciliationRules").add({
      uid,
      name,
      condition,
      adjustment: adjustment || null,
      networkId: networkId || null,
      enabled,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const doc = await ref.get();
    return NextResponse.json({ rule: serializeDoc(doc) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/reconciliation/rules error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
