import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { isValidNetworkId, type NetworkId } from "@/lib/constants";
import { getApiKey, fetchNetworkStats } from "@/lib/networks/network-helpers";

// ─── Rate limiter ─────────────────────────────────────────────────────────────

const retryRateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function checkRetryRateLimit(uid: string, networkId: string): boolean {
  const key = `${uid}_${networkId}`;
  const now = Date.now();
  const entry = retryRateLimit.get(key);
  if (!entry || now >= entry.resetAt) {
    retryRateLimit.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

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
      if (IS_4XX.test(msg)) throw err;
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const body = await request.json().catch(() => ({}));
    const { networkId } = body as { networkId?: string };

    if (!networkId || !isValidNetworkId(networkId)) {
      return NextResponse.json({ error: "Valid networkId is required" }, { status: 400 });
    }

    if (!checkRetryRateLimit(uid, networkId)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Maximum 5 retries per hour per network." },
        { status: 429 }
      );
    }

    let apiKey: string | null = null;
    try {
      apiKey = await getApiKey(uid, networkId);
    } catch {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured for this network" }, { status: 404 });
    }

    const today = new Date().toISOString().split("T")[0];
    const networkConfigRef = adminDb
      .collection("users").doc(uid)
      .collection("networkConfigs").doc(networkId);

    let rawData: unknown;
    try {
      rawData = await fetchWithRetry(networkId, apiKey, today, today);
    } catch (fetchError) {
      const errMsg = (fetchError as Error).message?.slice(0, 200) ?? "fetch failed";
      // Always update networkConfigs — even if audit log write fails
      await networkConfigRef.set(
        { lastSyncStatus: "failed", lastSyncError: errMsg, lastSyncedAt: FieldValue.serverTimestamp() },
        { merge: true }
      ).catch(() => {});
      await adminDb.collection("auditLogs").add({
        userId: uid, action: "sync_failed", networkId,
        details: { error: errMsg, triggeredBy: "retry" },
        createdAt: FieldValue.serverTimestamp(),
      }).catch(() => {});
      return NextResponse.json({ error: "Failed to fetch data from network" }, { status: 502 });
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
      const dateKey = (stat.date as string) || today;
      const docId = `${uid}_${networkId}_${dateKey}`;
      const ref = adminDb.collection("adStats").doc(docId);
      batch.set(ref, {
        uid, networkId, date: dateKey,
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

    // Firestore write failure → return 500
    if (storedCount > 0) {
      try {
        await batch.commit();
      } catch (writeError) {
        console.error("POST /api/scheduled/retry-failed batch.commit error:", writeError);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
      }
    }

    // Always update networkConfigs — audit log failure must not prevent this
    await networkConfigRef.set(
      { lastSyncStatus: "success", lastSyncError: null, lastSyncedAt: FieldValue.serverTimestamp() },
      { merge: true }
    ).catch(() => {});

    await adminDb.collection("auditLogs").add({
      userId: uid, action: "sync_completed", networkId,
      details: { date: today, recordsStored: storedCount, triggeredBy: "retry" },
      createdAt: FieldValue.serverTimestamp(),
    }).catch(() => {});

    return NextResponse.json({ success: true, networkId, recordsStored: storedCount });
  } catch (error) {
    console.error("POST /api/scheduled/retry-failed error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
