import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { isValidNetworkId } from "@/lib/constants";
import { serializeDoc } from "@/lib/networks/network-helpers";
import { computeRoi } from "@/lib/roi/formula";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const country = searchParams.get("country");
    const networkId = searchParams.get("networkId");

    // Range mode: dateFrom + dateTo (used by GeoCountryDrilldownModal)
    if (dateFrom || dateTo) {
      if (!dateFrom || !DATE_RE.test(dateFrom) || !dateTo || !DATE_RE.test(dateTo)) {
        return NextResponse.json({ error: "dateFrom and dateTo must be in YYYY-MM-DD format" }, { status: 400 });
      }

      let query = adminDb
        .collection("adStats")
        .where("uid", "==", uid)
        .where("date", ">=", dateFrom)
        .where("date", "<=", dateTo) as FirebaseFirestore.Query;

      if (networkId && isValidNetworkId(networkId)) {
        query = query.where("networkId", "==", networkId);
      }

      const snap = await query.get();

      // Build daily aggregates (optionally filtered by country)
      const byDate: Record<string, { revenue: number; cost: number }> = {};
      const byNetwork: Record<string, { revenue: number; cost: number; hasCost: boolean; hasRevenue: boolean }> = {};

      snap.forEach((doc) => {
        const d = doc.data();
        if (country && d.country && d.country !== country) return;
        const day = String(d.date ?? "");
        if (!byDate[day]) byDate[day] = { revenue: 0, cost: 0 };
        byDate[day].revenue += Number(d.revenue) || 0;
        byDate[day].cost += Number(d.cost) || 0;

        const net = String(d.networkId ?? "unknown");
        if (!byNetwork[net]) byNetwork[net] = { revenue: 0, cost: 0, hasCost: false, hasRevenue: false };
        byNetwork[net].revenue += Number(d.revenue) || 0;
        byNetwork[net].cost += Number(d.cost) || 0;
        if (Number(d.revenue) > 0) byNetwork[net].hasRevenue = true;
        if (Number(d.cost) > 0) byNetwork[net].hasCost = true;
      });

      const days = Object.entries(byDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([d, { revenue, cost }]) => ({ date: d, netProfit: revenue - cost }));

      const totalRevenue = days.reduce((s, d) => s + (d.netProfit > 0 ? d.netProfit : 0), 0);
      const totalNetProfit = days.reduce((s, d) => s + d.netProfit, 0);

      const networkBreakdown = Object.entries(byNetwork).map(([networkName, val]) => {
        const dataRole: "Cost Only" | "Revenue Only" | "Both" =
          val.hasRevenue && val.hasCost ? "Both" : val.hasRevenue ? "Revenue Only" : "Cost Only";
        const primaryMetricValue = val.revenue > 0 ? val.revenue : val.cost > 0 ? val.cost : null;
        const percentageOfTotal = totalRevenue > 0 ? (val.revenue / totalRevenue) * 100 : 0;
        return { networkName, dataRole, primaryMetricValue, percentageOfTotal };
      });

      if (days.length === 0) {
        return NextResponse.json({ error: "No data found for this range" }, { status: 404 });
      }

      return NextResponse.json({ dateFrom, dateTo, country: country ?? null, days, networkBreakdown, totalNetProfit });
    }

    // Single-date mode (legacy)
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

    let totalRevenue = 0;
    let totalCost = 0;
    let totalImpressions = 0;
    let totalClicks = 0;

    snapshot.forEach((doc) => {
      const d = doc.data();
      totalRevenue += Number(d.revenue) || 0;
      totalCost += Number(d.cost) || 0;
      totalImpressions += Number(d.impressions) || 0;
      totalClicks += Number(d.clicks) || 0;
    });

    const netProfit = totalRevenue - totalCost;
    const roi = computeRoi(totalRevenue, totalCost) ?? 0;
    const stats = snapshot.docs.map(serializeDoc).filter(Boolean);

    return NextResponse.json({
      date,
      networkId: networkId || null,
      revenue: totalRevenue,
      cost: totalCost,
      netProfit,
      roi,
      impressions: totalImpressions,
      clicks: totalClicks,
      stats,
    });
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
