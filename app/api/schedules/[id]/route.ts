import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { serializeDoc } from "@/lib/networks/network-helpers";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const { id } = await params;
    const doc = await adminDb.collection("schedules").doc(id).get();

    if (!doc.exists || doc.data()?.uid !== uid) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    const body = await request.json();
    const allowed = ["name", "cronExpression", "enabled", "dateRangeDays", "networkId"];
    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };

    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    await doc.ref.update(updates);
    const updated = await doc.ref.get();
    return NextResponse.json({ schedule: serializeDoc(updated) });
  } catch (error) {
    console.error("PATCH /api/schedules/[id] error:", error);
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
    const doc = await adminDb.collection("schedules").doc(id).get();

    if (!doc.exists || doc.data()?.uid !== uid) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    await doc.ref.delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/schedules/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
