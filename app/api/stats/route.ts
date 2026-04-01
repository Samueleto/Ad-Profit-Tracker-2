import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { isValidNetworkId } from "@/lib/constants";
import { serializeDoc } from "@/lib/networks/network-helpers";

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const networkId = searchParams.get("networkId");
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 1000);

    let query = adminDb
      .collection("adStats")
      .where("uid", "==", uid)
      .orderBy("date", "desc")
      .limit(limit);

    if (networkId && isValidNetworkId(networkId)) {
      query = adminDb
        .collection("adStats")
        .where("uid", "==", uid)
        .where("networkId", "==", networkId)
        .orderBy("date", "desc")
        .limit(limit);
    }

    const snapshot = await query.get();
    let stats = snapshot.docs.map(serializeDoc).filter(Boolean);

    if (dateFrom) {
      stats = stats.filter((s) => {
        const d = (s as Record<string, unknown>)?.date;
        return typeof d === 'string' && d >= dateFrom;
      });
    }
    if (dateTo) {
      stats = stats.filter((s) => {
        const d = (s as Record<string, unknown>)?.date;
        return typeof d === 'string' && d <= dateTo;
      });
    }

    return NextResponse.json({ stats, total: stats.length });
  } catch (error) {
    console.error("GET /api/stats error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const body = await request.json();
    const { networkId, date, impressions, clicks, revenue, cost, ctr, ecpm, country } = body;

    if (!networkId || !isValidNetworkId(networkId)) {
      return NextResponse.json({ error: "Valid networkId is required" }, { status: 400 });
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "date must be in YYYY-MM-DD format" }, { status: 400 });
    }

    const docId = `${uid}_${networkId}_${date}`;
    const ref = adminDb.collection("adStats").doc(docId);

    await ref.set(
      {
        uid,
        networkId,
        date,
        impressions: Number(impressions) || 0,
        clicks: Number(clicks) || 0,
        ctr: Number(ctr) || 0,
        revenue: Number(revenue) || 0,
        ecpm: Number(ecpm) || 0,
        cost: Number(cost) || 0,
        country: country || null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const doc = await ref.get();
    return NextResponse.json({ stat: serializeDoc(doc) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/stats error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
