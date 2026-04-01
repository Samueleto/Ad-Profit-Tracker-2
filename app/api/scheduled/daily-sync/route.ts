import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyInternalSecret } from "@/lib/firebase-admin/verify-internal-secret";
import { getApiKey, fetchNetworkStats } from "@/lib/networks/network-helpers";
import { isValidNetworkId, type NetworkId } from "@/lib/constants";

// ─── Exponential backoff fetch ────────────────────────────────────────────────

const IS_4XX = /\b4\d{2}\b/;

async function fetchWithRetry(
  networkId: NetworkId,
  apiKey: string,
  dateFrom: string,
  dateTo: string,
  maxRetries = 3
): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetchNetworkStats(networkId, apiKey, dateFrom, dateTo);
    } catch (err) {
      lastError = err;
      const msg = (err as Error).message ?? '';
      // Never retry on 4xx — those are permanent failures
      if (IS_4XX.test(msg)) throw err;
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt))); // 1s, 2s, 4s
      }
    }
  }
  throw lastError;
}

// ─── Per-task processor ───────────────────────────────────────────────────────

interface SyncTask {
  uid: string;
  networkId: NetworkId;
  dateFrom: string;
  dateTo: string;
}

async function processTask(task: SyncTask): Promise<{ uid: string; networkId: string; status: string; records?: number }> {
  const { uid, networkId, dateFrom, dateTo } = task;

  // Get API key
  let apiKey: string | null = null;
  try {
    apiKey = await getApiKey(uid, networkId);
  } catch {
    await adminDb.collection("auditLogs").add({
      userId: uid, action: "sync_failed", networkId,
      details: { error: "API key decryption failed", triggeredBy: "scheduled" },
      createdAt: FieldValue.serverTimestamp(),
    }).catch(() => {});
    await adminDb.collection("users").doc(uid)
      .collection("networkConfigs").doc(networkId)
      .set({ lastSyncStatus: "failed", lastSyncError: "API key decryption failed", lastSyncedAt: FieldValue.serverTimestamp() }, { merge: true })
      .catch(() => {});
    return { uid, networkId, status: "error_decryption" };
  }

  if (!apiKey) {
    return { uid, networkId, status: "skipped_no_key" };
  }

  // Fetch with exponential backoff retry
  let rawData: unknown;
  try {
    rawData = await fetchWithRetry(networkId, apiKey, dateFrom, dateTo);
  } catch (fetchError) {
    const errMsg = (fetchError as Error).message?.slice(0, 200) ?? "fetch failed";
    // Update networkConfigs — this must succeed before the audit log
    await adminDb.collection("users").doc(uid)
      .collection("networkConfigs").doc(networkId)
      .set({ lastSyncStatus: "failed", lastSyncError: errMsg, lastSyncedAt: FieldValue.serverTimestamp() }, { merge: true })
      .catch(() => {});
    await adminDb.collection("auditLogs").add({
      userId: uid, action: "sync_failed", networkId,
      details: { error: errMsg, dateFrom, dateTo, triggeredBy: "scheduled" },
      createdAt: FieldValue.serverTimestamp(),
    }).catch(() => {});
    return { uid, networkId, status: "error_fetch" };
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
    batch.set(ref, {
      userId: uid, networkId, date: dateKey,
      impressions: Number(stat.impressions) || 0,
      clicks: Number(stat.clicks) || 0,
      ctr: Number(stat.ctr) || 0,
      revenue: Number(stat.revenue) || 0,
      ecpm: Number(stat.ecpm) || 0,
      cost: Number(stat.cost) || 0,
      country: stat.country || null,
      syncedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    storedCount++;
  }

  if (storedCount > 0) await batch.commit();

  // Update networkConfigs with success
  await adminDb.collection("users").doc(uid)
    .collection("networkConfigs").doc(networkId)
    .set({ lastSyncStatus: "success", lastSyncError: null, lastSyncedAt: FieldValue.serverTimestamp() }, { merge: true })
    .catch(() => {});

  await adminDb.collection("auditLogs").add({
    userId: uid, action: "sync_completed", networkId,
    details: { dateFrom, dateTo, recordsStored: storedCount, triggeredBy: "scheduled" },
    createdAt: FieldValue.serverTimestamp(),
  }).catch(() => {});

  return { uid, networkId, status: "ok", records: storedCount };
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const authError = verifyInternalSecret(request);
  if (authError) return authError;

  const startedAt = new Date().toISOString();

  try {
    // Collect all active scheduled sync tasks across all users
    const tasks: SyncTask[] = [];
    const usersSnapshot = await adminDb.collection("users").get();

    for (const userDoc of usersSnapshot.docs) {
      const uid = userDoc.id;
      const schedulesSnapshot = await adminDb
        .collection("users").doc(uid)
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
          .toISOString().split("T")[0];

        tasks.push({ uid, networkId, dateFrom, dateTo });
      }
    }

    // Parallel fan-out — one failure never crashes another
    const settled = await Promise.allSettled(tasks.map(task => processTask(task)));

    const results = settled.map((s, i) =>
      s.status === "fulfilled"
        ? s.value
        : { uid: tasks[i].uid, networkId: tasks[i].networkId, status: "error_unhandled" }
    );

    return NextResponse.json({
      startedAt,
      completedAt: new Date().toISOString(),
      networksSucceeded: results.filter(r => r.status === "ok").length,
      networksFailed: results.filter(r => r.status.startsWith("error")).length,
      networksSkipped: results.filter(r => r.status.startsWith("skipped")).length,
    });
  } catch (error) {
    console.error("POST /api/scheduled/daily-sync error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
