import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyInternalSecret } from "@/lib/firebase-admin/verify-internal-secret";
import { getApiKey, fetchNetworkStats } from "@/lib/networks/network-helpers";
import { isValidNetworkId } from "@/lib/constants";

export async function POST(request: Request) {
  const authError = verifyInternalSecret(request);
  if (authError) return authError;

  const startedAt = new Date().toISOString();
  const results: { uid: string; networkId: string; status: string; records?: number }[] = [];

  try {
    // Collect all active scheduled syncs across all users
    const usersSnapshot = await adminDb.collection("users").get();

    for (const userDoc of usersSnapshot.docs) {
      const uid = userDoc.id;

      const schedulesSnapshot = await adminDb
        .collection("users")
        .doc(uid)
        .collection("scheduledSyncs")
        .where("enabled", "==", true)
        .get();

      for (const scheduleDoc of schedulesSnapshot.docs) {
        const schedule = scheduleDoc.data();
        const networkId = schedule.networkId as string;

        if (!networkId || !isValidNetworkId(networkId)) continue;

        const dateRangeDays: number = Number(schedule.dateRangeDays) || 1;
        const today = new Date();
        const dateTo = today.toISOString().split("T")[0];
        const dateFrom = new Date(today.getTime() - (dateRangeDays - 1) * 86400000)
          .toISOString()
          .split("T")[0];

        let apiKey: string | null = null;
        try {
          apiKey = await getApiKey(uid, networkId);
        } catch {
          // Decrypt failure — log without exposing key material
          await adminDb.collection("auditLogs").add({
            userId: uid,
            action: "sync_failed",
            networkId,
            details: { error: "API key decryption failed", triggeredBy: "scheduled" },
            createdAt: FieldValue.serverTimestamp(),
          }).catch(() => {});
          results.push({ uid, networkId, status: "error_decryption" });
          continue;
        }

        if (!apiKey) {
          results.push({ uid, networkId, status: "skipped_no_key" });
          continue;
        }

        let rawData: unknown;
        try {
          rawData = await fetchNetworkStats(networkId, apiKey, dateFrom, dateTo);
        } catch (fetchError) {
          await adminDb.collection("auditLogs").add({
            userId: uid,
            action: "sync_failed",
            networkId,
            details: {
              error: (fetchError as Error).message?.slice(0, 200) ?? "fetch failed",
              dateFrom,
              dateTo,
              triggeredBy: "scheduled",
            },
            createdAt: FieldValue.serverTimestamp(),
          }).catch(() => {});
          results.push({ uid, networkId, status: "error_fetch" });
          continue;
        }

        const statsArray = Array.isArray(rawData)
          ? rawData
          : (rawData as Record<string, unknown>)?.data
          ? ((rawData as Record<string, unknown>).data as unknown[])
          : [];

        const batch = adminDb.batch();
        let storedCount = 0;

        for (const item of statsArray.slice(0, 500)) {
          const stat = item as Record<string, unknown>;
          const dateKey = (stat.date as string) || dateFrom;
          const docId = `${uid}_${networkId}_${dateKey}`;
          const ref = adminDb.collection("adStats").doc(docId);

          batch.set(
            ref,
            {
              userId: uid,
              networkId,
              date: dateKey,
              impressions: Number(stat.impressions) || 0,
              clicks: Number(stat.clicks) || 0,
              ctr: Number(stat.ctr) || 0,
              revenue: Number(stat.revenue) || 0,
              ecpm: Number(stat.ecpm) || 0,
              cost: Number(stat.cost) || 0,
              country: stat.country || null,
              syncedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          storedCount++;
        }

        if (storedCount > 0) await batch.commit();

        await adminDb.collection("auditLogs").add({
          userId: uid,
          action: "sync_completed",
          networkId,
          details: { dateFrom, dateTo, recordsStored: storedCount, triggeredBy: "scheduled" },
          createdAt: FieldValue.serverTimestamp(),
        }).catch(() => {});

        results.push({ uid, networkId, status: "ok", records: storedCount });
      }
    }

    return NextResponse.json({
      startedAt,
      completedAt: new Date().toISOString(),
      synced: results.filter((r) => r.status === "ok").length,
      errors: results.filter((r) => r.status.startsWith("error")).length,
      skipped: results.filter((r) => r.status.startsWith("skipped")).length,
    });
  } catch (error) {
    console.error("POST /api/scheduled/daily-sync error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
