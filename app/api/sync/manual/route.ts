import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { isValidNetworkId } from "@/lib/constants";
import { getApiKey, createAuditLog, fetchNetworkStats } from "@/lib/networks/network-helpers";

export async function POST(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const body = await request.json();
    const { networkId, dateFrom, dateTo } = body;

    if (!networkId || !isValidNetworkId(networkId)) {
      return NextResponse.json({ error: "Valid networkId is required" }, { status: 400 });
    }

    const apiKey = await getApiKey(uid, networkId);
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured for this network" }, { status: 400 });
    }

    const today = new Date().toISOString().split("T")[0];
    const syncFrom = dateFrom || today;
    const syncTo = dateTo || today;

    let rawData: unknown;
    try {
      rawData = await fetchNetworkStats(networkId, apiKey, syncFrom, syncTo);
    } catch (fetchError) {
      await createAuditLog(uid, "sync_failed", networkId, {
        error: (fetchError as Error).message,
        dateFrom: syncFrom,
        dateTo: syncTo,
        triggeredBy: "manual",
      });
      return NextResponse.json({ error: "Failed to fetch data from network" }, { status: 502 });
    }

    // Store raw response
    await adminDb
      .collection("users")
      .doc(uid)
      .collection("rawResponses")
      .doc(networkId)
      .set({
        data: rawData,
        fetchedAt: FieldValue.serverTimestamp(),
        dateFrom: syncFrom,
        dateTo: syncTo,
      });

    const statsArray = Array.isArray(rawData)
      ? rawData
      : (rawData as Record<string, unknown>)?.data
      ? ((rawData as Record<string, unknown>).data as unknown[])
      : [];

    const batch = adminDb.batch();
    let storedCount = 0;

    for (const item of statsArray.slice(0, 500)) {
      const stat = item as Record<string, unknown>;
      const dateKey = (stat.date as string) || syncFrom;
      const docId = `${uid}_${networkId}_${dateKey}`;
      const ref = adminDb.collection("adStats").doc(docId);

      batch.set(
        ref,
        {
          uid,
          networkId,
          date: dateKey,
          impressions: Number(stat.impressions) || 0,
          clicks: Number(stat.clicks) || 0,
          ctr: Number(stat.ctr) || 0,
          revenue: Number(stat.revenue) || 0,
          ecpm: Number(stat.ecpm) || 0,
          cost: Number(stat.cost) || 0,
          country: stat.country || null,
          rawData: stat,
          syncedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      storedCount++;
    }

    if (storedCount > 0) await batch.commit();

    await createAuditLog(uid, "sync_completed", networkId, {
      dateFrom: syncFrom,
      dateTo: syncTo,
      recordsStored: storedCount,
      triggeredBy: "manual",
    });

    return NextResponse.json({
      success: true,
      networkId,
      recordsStored: storedCount,
      dateFrom: syncFrom,
      dateTo: syncTo,
    });
  } catch (error) {
    console.error("POST /api/sync/manual error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
