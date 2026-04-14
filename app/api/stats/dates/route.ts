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

    let query = adminDb
      .collection("adStats")
      .where("uid", "==", uid) as FirebaseFirestore.Query;

    if (networkId) {
      query = query.where("networkId", "==", networkId);
    }

    if (dateFrom) {
      query = query.where("date", ">=", dateFrom);
    }

    const snapshot = await query.get();
    const dates = new Set<string>();

    for (const doc of snapshot.docs) {
      const d = doc.data().date;
      if (typeof d === "string") {
        if (!dateTo || d <= dateTo) {
          dates.add(d);
        }
      }
    }

    const sortedDates = Array.from(dates).sort().reverse();
    const total = dates.size;

    // Compute availability for DataAvailabilityDot component
    let availability: 'full' | 'partial' | 'none' = 'none';
    if (total > 0 && dateFrom && dateTo) {
      const rangeDays = Math.round(
        (new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000
      ) + 1;
      availability = total >= rangeDays * 0.8 ? 'full' : 'partial';
    } else if (total > 0) {
      availability = 'full';
    }

    return NextResponse.json({
      networkId: networkId || null,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      dates: sortedDates,
      total,
      availability,
    });
  } catch (error) {
    console.error("GET /api/stats/dates error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
