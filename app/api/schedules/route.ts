import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { serializeDoc } from "@/lib/networks/network-helpers";

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  const { searchParams } = new URL(request.url);
  const reportId = searchParams.get("reportId");

  try {
    if (reportId) {
      // Return the single schedule for this report (if any)
      const snapshot = await adminDb
        .collection("schedules")
        .where("uid", "==", uid)
        .where("reportId", "==", reportId)
        .limit(1)
        .get();
      const schedule = snapshot.empty ? null : serializeDoc(snapshot.docs[0]);
      return NextResponse.json({ schedule });
    }

    const snapshot = await adminDb
      .collection("schedules")
      .where("uid", "==", uid)
      .orderBy("createdAt", "desc")
      .get();

    const schedules = snapshot.docs.map(serializeDoc);
    return NextResponse.json({ schedules });
  } catch (error) {
    console.error("GET /api/schedules error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const body = await request.json();
    const { name, networkId, cronExpression, enabled = true, dateRangeDays = 1 } = body;

    if (!name || !cronExpression) {
      return NextResponse.json({ error: "name and cronExpression are required" }, { status: 400 });
    }

    const ref = await adminDb.collection("schedules").add({
      uid,
      name,
      networkId: networkId || null,
      cronExpression,
      enabled,
      dateRangeDays,
      lastRun: null,
      nextRun: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const doc = await ref.get();
    return NextResponse.json({ schedule: serializeDoc(doc) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/schedules error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
