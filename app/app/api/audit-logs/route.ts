import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
    const networkId = searchParams.get("networkId");
    const action = searchParams.get("action");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    let query = adminDb
      .collection("auditLogs")
      .where("uid", "==", uid)
      .orderBy("timestamp", "desc")
      .limit(limit);

    if (networkId) {
      query = adminDb
        .collection("auditLogs")
        .where("uid", "==", uid)
        .where("networkId", "==", networkId)
        .orderBy("timestamp", "desc")
        .limit(limit);
    }

    const snapshot = await query.get();

    let logs = snapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      return {
        id: doc.id,
        ...data,
        timestamp: (data.timestamp as { toDate?: () => Date })?.toDate?.()?.toISOString() || null,
      };
    });

    // Filter in-memory for additional filters
    if (action) {
      logs = logs.filter((log) => (log as Record<string, unknown>).action === action);
    }
    if (startDate) {
      logs = logs.filter((log) => log.timestamp && log.timestamp >= startDate);
    }
    if (endDate) {
      logs = logs.filter((log) => log.timestamp && log.timestamp <= endDate + "T23:59:59Z");
    }

    return NextResponse.json({ logs, total: logs.length });
  } catch (error) {
    console.error("GET /api/audit-logs error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const body = await request.json();
    const { action, networkId, details } = body;

    if (!action) {
      return NextResponse.json({ error: "action is required" }, { status: 400 });
    }

    const logRef = await adminDb.collection("auditLogs").add({
      uid,
      action,
      networkId: networkId || null,
      details: details || null,
      timestamp: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ id: logRef.id, success: true }, { status: 201 });
  } catch (error) {
    console.error("POST /api/audit-logs error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
