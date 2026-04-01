import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const { id } = await params;
    const doc = await adminDb.collection("auditLogs").doc(id).get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Audit log not found" }, { status: 404 });
    }

    const data = doc.data()!;
    if (data.uid !== uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      log: {
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toDate?.()?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error("GET /api/audit-logs/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
