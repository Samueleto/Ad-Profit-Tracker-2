import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { isValidNetworkId } from "@/lib/constants";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const { searchParams } = new URL(request.url);
    const networkId = searchParams.get("networkId");
    const errorCode = searchParams.get("errorCode");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const cursor = searchParams.get("cursor");
    const rawLimit = searchParams.get("limit");

    if (networkId && !isValidNetworkId(networkId)) {
      return NextResponse.json({ error: "Invalid networkId" }, { status: 400 });
    }

    // Validate limit: integer 1-50
    let limit = 20;
    if (rawLimit !== null) {
      const parsed = parseInt(rawLimit, 10);
      if (!Number.isInteger(parsed) || isNaN(parsed) || parsed < 1 || parsed > 50) {
        return NextResponse.json(
          { error: "limit must be an integer between 1 and 50" },
          { status: 400 }
        );
      }
      limit = parsed;
    }

    // Validate date format
    if (startDate && !DATE_RE.test(startDate)) {
      return NextResponse.json({ error: "startDate must be in YYYY-MM-DD format" }, { status: 400 });
    }
    if (endDate && !DATE_RE.test(endDate)) {
      return NextResponse.json({ error: "endDate must be in YYYY-MM-DD format" }, { status: 400 });
    }

    // Query auditLogs scoped to uid — build incrementally so filters compose
    let query = adminDb
      .collection("auditLogs")
      .where("userId", "==", uid) as FirebaseFirestore.Query;

    if (networkId) {
      query = query.where("networkId", "==", networkId);
    }

    query = query
      .where("action", "in", ["sync_completed", "sync_failed", "sync_triggered", "backfill_completed", "backfill_failed"])
      .orderBy("createdAt", "desc");

    if (cursor) {
      const cursorDoc = await adminDb.collection("auditLogs").doc(cursor).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    query = query.limit(limit + 1);

    const snapshot = await query.get();
    const hasMore = snapshot.docs.length > limit;
    const pageDocs = hasMore ? snapshot.docs.slice(0, limit) : snapshot.docs;

    let logs = pageDocs.map((doc) => {
      const data = doc.data();
      const details = (data.details ?? data.metadata ?? {}) as Record<string, unknown>;
      return {
        id: doc.id,
        action: data.action,
        errorCode: (details.errorCode as string) ?? null,
        networkId: data.networkId || null,
        // details is the canonical field; fall back to metadata for older docs
        metadata: details,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      };
    });

    if (startDate) {
      logs = logs.filter((log) => log.createdAt && log.createdAt >= startDate);
    }
    if (endDate) {
      logs = logs.filter((log) => log.createdAt && log.createdAt <= endDate + "T23:59:59Z");
    }
    if (errorCode) {
      logs = logs.filter((log) => log.errorCode === errorCode || log.action === errorCode);
    }

    const nextCursor = hasMore && pageDocs.length > 0 ? pageDocs[pageDocs.length - 1].id : null;

    return NextResponse.json({ logs, errors: logs, total: logs.length, hasMore, nextCursor });
  } catch (error) {
    console.error("GET /api/errors/log error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
