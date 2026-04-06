import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { serializeDoc } from "@/lib/networks/network-helpers";

// Fields allowed for data-sync schedules
const DATA_SYNC_ALLOWED = new Set([
  "name", "cronExpression", "enabled", "dateRangeDays", "networkId",
]);

// Fields allowed for report-delivery schedules
const REPORT_DELIVERY_ALLOWED = new Set([
  "frequency", "dayOfWeek", "dayOfMonth", "deliveryHour",
  "timezone", "deliveryEmail", "dateRangePreset", "format", "isActive",
  "reportName",
]);

const VALID_FREQUENCIES = new Set(["daily", "weekly", "monthly"]);
const VALID_FORMATS = new Set(["excel", "pdf"]);
const VALID_PRESETS = new Set(["yesterday", "last_7", "last_30", "last_90", "this_month"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

    const scheduleType: string = doc.data()?.type ?? "data_sync";
    const body = await request.json();
    const allowedSet = scheduleType === "report_delivery" ? REPORT_DELIVERY_ALLOWED : DATA_SYNC_ALLOWED;
    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };

    for (const key of allowedSet) {
      if (!(key in body)) continue;
      const val = body[key];

      // Per-field validation for report_delivery fields
      if (scheduleType === "report_delivery") {
        if (key === "frequency" && !VALID_FREQUENCIES.has(val as string)) {
          return NextResponse.json({ message: "Validation failed.", fieldErrors: { frequency: "Invalid frequency." } }, { status: 400 });
        }
        if (key === "dayOfWeek" && (typeof val !== "number" || val < 0 || val > 6)) {
          return NextResponse.json({ message: "Validation failed.", fieldErrors: { dayOfWeek: "dayOfWeek must be 0–6." } }, { status: 400 });
        }
        if (key === "dayOfMonth" && (typeof val !== "number" || val < 1 || val > 28)) {
          return NextResponse.json({ message: "Validation failed.", fieldErrors: { dayOfMonth: "dayOfMonth must be 1–28." } }, { status: 400 });
        }
        if (key === "deliveryHour" && (typeof val !== "number" || val < 0 || val > 23)) {
          return NextResponse.json({ message: "Validation failed.", fieldErrors: { deliveryHour: "deliveryHour must be 0–23." } }, { status: 400 });
        }
        if (key === "deliveryEmail" && (typeof val !== "string" || !EMAIL_RE.test(val))) {
          return NextResponse.json({ message: "Validation failed.", fieldErrors: { deliveryEmail: "Invalid email." } }, { status: 400 });
        }
        if (key === "format" && !VALID_FORMATS.has(val as string)) {
          return NextResponse.json({ message: "Validation failed.", fieldErrors: { format: "Invalid format." } }, { status: 400 });
        }
        if (key === "dateRangePreset" && !VALID_PRESETS.has(val as string)) {
          return NextResponse.json({ message: "Validation failed.", fieldErrors: { dateRangePreset: "Invalid preset." } }, { status: 400 });
        }
      }

      updates[key] = val;
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
