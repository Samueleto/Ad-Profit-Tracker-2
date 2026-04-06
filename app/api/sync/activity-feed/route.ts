import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { isValidNetworkId } from "@/lib/constants";
import { serializeDoc } from "@/lib/networks/network-helpers";

const MAX_LIMIT = 50;

function deriveEventLabel(
  action: string
): "Scheduled Sync" | "Manual Sync" | "Backfill" | "Retry" {
  if (action === "sync_triggered" || action === "sync_started") return "Scheduled Sync";
  if (action === "backfill_triggered") return "Backfill";
  if (action === "retry_triggered") return "Retry";
  return "Manual Sync";
}

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(
    parseInt(searchParams.get("limit") || "10"),
    MAX_LIMIT
  );
  const cursor = searchParams.get("cursor");
  const networkId = searchParams.get("networkId");

  try {
    let query = adminDb
      .collection("auditLogs")
      .where("uid", "==", uid)
      .where("action", "in", [
        "sync_completed",
        "sync_failed",
        "sync_triggered",
        "backfill_triggered",
        "retry_triggered",
      ])
      .orderBy("timestamp", "desc")
      .limit(limit + 1); // fetch one extra to determine hasMore

    if (networkId && isValidNetworkId(networkId)) {
      query = adminDb
        .collection("auditLogs")
        .where("uid", "==", uid)
        .where("networkId", "==", networkId)
        .where("action", "in", [
          "sync_completed",
          "sync_failed",
          "sync_triggered",
          "backfill_triggered",
          "retry_triggered",
        ])
        .orderBy("timestamp", "desc")
        .limit(limit + 1);
    }

    if (cursor) {
      const cursorDoc = await adminDb.collection("auditLogs").doc(cursor).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    const snapshot = await query.get();
    const docs = snapshot.docs;
    const hasMore = docs.length > limit;
    const page = hasMore ? docs.slice(0, limit) : docs;

    const feed = page.map((doc) => {
      const data = serializeDoc(doc) as Record<string, unknown>;
      const meta = (data.metadata as Record<string, unknown>) ?? {};
      return {
        id: doc.id,
        networkId: String(data.networkId ?? ""),
        status:
          String(data.action).includes("failed") ? "failure" : "success",
        eventLabel: deriveEventLabel(String(data.action ?? "")),
        rowsFetched:
          meta.recordsStored != null ? Number(meta.recordsStored) : null,
        latencyMs: meta.latencyMs != null ? Number(meta.latencyMs) : null,
        dateFrom: meta.dateFrom ? String(meta.dateFrom) : null,
        dateTo: meta.dateTo ? String(meta.dateTo) : null,
        createdAt: String(data.timestamp ?? new Date().toISOString()),
      };
    });

    const nextCursor =
      hasMore && page.length > 0 ? page[page.length - 1].id : null;

    return NextResponse.json({ feed, hasMore, nextCursor });
  } catch (error) {
    console.error("GET /api/sync/activity-feed error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
