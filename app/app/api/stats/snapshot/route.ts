import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { isValidNetworkId } from "@/lib/constants";
import { serializeDoc } from "@/lib/networks/network-helpers";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const networkId = searchParams.get("networkId");

    if (!date || !DATE_RE.test(date)) {
      return NextResponse.json({ error: "date must be in YYYY-MM-DD format" }, { status: 400 });
    }

    if (networkId && !isValidNetworkId(networkId)) {
      return NextResponse.json({ error: "Invalid networkId" }, { status: 400 });
    }

    let query = adminDb
      .collection("adStats")
      .where("uid", "==", uid)
      .where("date", "==", date) as FirebaseFirestore.Query;

    if (networkId) {
      query = query.where("networkId", "==", networkId);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      return NextResponse.json({ error: "No snapshot found for this date" }, { status: 404 });
    }

    const stats = snapshot.docs.map(serializeDoc).filter(Boolean);

    return NextResponse.json({ date, networkId: networkId || null, stats });
  } catch (error) {
    console.error("GET /api/stats/snapshot error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// In-memory rate limit: 5 deletes per hour per uid
const deleteRateLimit = new Map<string, { count: number; resetAt: number }>();

export async function DELETE(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  // Rate limit: 5 deletes per hour
  const now = Date.now();
  const entry = deleteRateLimit.get(uid);
  if (entry && now < entry.resetAt && entry.count >= 5) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      { error: "Rate limit exceeded. Maximum 5 deletes per hour." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }
  if (!entry || now >= entry.resetAt) {
    deleteRateLimit.set(uid, { count: 1, resetAt: now + 60 * 60 * 1000 });
  } else {
    entry.count++;
  }

  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const networkId = searchParams.get("networkId");

    if (!date || !DATE_RE.test(date)) {
      return NextResponse.json({ error: "date must be in YYYY-MM-DD format" }, { status: 400 });
    }

    if (networkId && !isValidNetworkId(networkId)) {
      return NextResponse.json({ error: "Invalid networkId" }, { status: 400 });
    }

    let query = adminDb
      .collection("adStats")
      .where("uid", "==", uid)
      .where("date", "==", date) as FirebaseFirestore.Query;

    if (networkId) {
      query = query.where("networkId", "==", networkId);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      return NextResponse.json({ error: "No snapshot found for this date" }, { status: 404 });
    }

    const batch = adminDb.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    const deletedCount = snapshot.size;

    // Audit log — fire-and-forget
    adminDb.collection("auditLogs").add({
      userId: uid,
      action: "snapshot_deleted",
      networkId: networkId || null,
      metadata: { date, deletedCount },
      createdAt: FieldValue.serverTimestamp(),
    }).catch((err: Error) => console.error("Audit log write failed:", err));

    return NextResponse.json({ success: true, deletedCount, date });
  } catch (error) {
    console.error("DELETE /api/stats/snapshot error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
