import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { serializeDoc } from "@/lib/networks/network-helpers";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const { id } = await params;
    const doc = await adminDb.collection("reconciliationRules").doc(id).get();

    if (!doc.exists || doc.data()?.uid !== uid) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    const body = await request.json();
    const allowed = ["name", "condition", "adjustment", "networkId", "enabled"];
    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };

    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    await doc.ref.update(updates);
    const updated = await doc.ref.get();
    return NextResponse.json({ rule: serializeDoc(updated) });
  } catch (error) {
    console.error("PUT /api/reconciliation/rules/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const { id } = await params;
    const doc = await adminDb.collection("reconciliationRules").doc(id).get();

    if (!doc.exists || doc.data()?.uid !== uid) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    await doc.ref.delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/reconciliation/rules/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
