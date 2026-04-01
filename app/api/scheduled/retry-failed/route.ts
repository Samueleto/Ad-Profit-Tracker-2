import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { isValidNetworkId } from "@/lib/constants";
import { getApiKey, fetchNetworkStats } from "@/lib/networks/network-helpers";

// In-memory rate limiter: 5 retries per hour per uid+network
const retryRateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

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

    // Rate limit check before any expensive work
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
      // Decryption failure — return 500 without revealing why
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured for this network" }, { status: 400 });
    }

    const today = new Date().toISOString().split("T")[0];

    let rawData: unknown;
    try {
      rawData = await fetchNetworkStats(networkId, apiKey, today, today);
    } catch (fetchError) {
      await adminDb.collection("auditLogs").add({
        userId: uid,
        action: "sync_failed",
        networkId,
        details: {
          error: (fetchError as Error).message?.slice(0, 200) ?? "fetch failed",
          triggeredBy: "retry",
        },
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
      details: { date: today, recordsStored: storedCount, triggeredBy: "retry" },
      createdAt: FieldValue.serverTimestamp(),
    }).catch(() => {});

    return NextResponse.json({ success: true, networkId, recordsStored: storedCount });
  } catch (error) {
    console.error("POST /api/scheduled/retry-failed error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
