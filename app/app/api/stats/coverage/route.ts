import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { isValidNetworkId } from "@/lib/constants";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 90;

function validateDateRange(dateFrom: string | null, dateTo: string | null): string | null {
  if (dateFrom && !DATE_RE.test(dateFrom)) return "dateFrom must be in YYYY-MM-DD format";
  if (dateTo && !DATE_RE.test(dateTo)) return "dateTo must be in YYYY-MM-DD format";
  if (dateFrom && dateTo) {
    if (dateFrom > dateTo) return "dateFrom must be <= dateTo";
    const diff = Math.round(
      (new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000
    );
    if (diff > MAX_RANGE_DAYS) return `Date range cannot exceed ${MAX_RANGE_DAYS} days`;
  }
  return null;
}

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const networkId = searchParams.get("networkId");

    const dateErr = validateDateRange(dateFrom, dateTo);
    if (dateErr) return NextResponse.json({ error: dateErr }, { status: 400 });

    if (networkId && !isValidNetworkId(networkId)) {
      return NextResponse.json({ error: "Invalid networkId" }, { status: 400 });
    }

    // Query adStats for coverage — always scoped to uid
    let statsQuery = adminDb
      .collection("adStats")
      .where("uid", "==", uid) as FirebaseFirestore.Query;

    if (networkId) {
      statsQuery = statsQuery.where("networkId", "==", networkId);
    }
    if (dateFrom) {
      statsQuery = statsQuery.where("date", ">=", dateFrom);
    }

    const statsSnapshot = await statsQuery.get();
    const dates = new Set<string>();

    for (const doc of statsSnapshot.docs) {
      const d = doc.data().date;
      if (typeof d === "string") {
        if (!dateTo || d <= dateTo) {
          dates.add(d);
        }
      }
    }

    // Query auditLogs for sync history — scoped to uid
    let logsQuery = adminDb
      .collection("auditLogs")
      .where("userId", "==", uid)
      .where("action", "in", ["sync_completed", "sync_failed"]) as FirebaseFirestore.Query;

    if (networkId) {
      logsQuery = logsQuery.where("networkId", "==", networkId);
    }

    const logsSnapshot = await logsQuery.orderBy("createdAt", "desc").limit(50).get();

    const syncHistory = logsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        action: data.action,
        networkId: data.networkId || null,
        metadata: data.metadata || null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      };
    });

    return NextResponse.json({
      networkId: networkId || null,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      coveredDates: Array.from(dates).sort(),
      coveredDaysCount: dates.size,
      syncHistory,
    });
  } catch (error) {
    console.error("GET /api/stats/coverage error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
