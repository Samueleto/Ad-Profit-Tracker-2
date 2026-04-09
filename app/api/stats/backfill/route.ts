import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { isValidNetworkId } from "@/lib/constants";
import { getApiKey, fetchNetworkStats } from "@/lib/networks/network-helpers";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 90;

function validateDateRange(dateFrom: string | null, dateTo: string | null): string | null {
  if (!dateFrom || !DATE_RE.test(dateFrom)) return "dateFrom must be in YYYY-MM-DD format";
  if (!dateTo || !DATE_RE.test(dateTo)) return "dateTo must be in YYYY-MM-DD format";
  if (dateFrom > dateTo) return "dateFrom must be <= dateTo";
  const diff = Math.round(
    (new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000
  );
  if (diff > MAX_RANGE_DAYS) return `Date range cannot exceed ${MAX_RANGE_DAYS} days`;
  return null;
}

// In-memory rate limit: 3 backfills per hour per uid
const backfillRateLimit = new Map<string, { count: number; resetAt: number }>();

// Sensitive field names to strip from raw API responses
const SENSITIVE_FIELD_RE = /key|token|secret|auth|credential/i;

function sanitizeRawResponse(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return (obj as unknown[]).map(sanitizeRawResponse);
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_FIELD_RE.test(k)) continue;
    result[k] = sanitizeRawResponse(v);
  }
  return result;
}

export async function POST(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  // Rate limit: 3 backfills per hour
  const now = Date.now();
  const entry = backfillRateLimit.get(uid);
  if (entry && now < entry.resetAt && entry.count >= 3) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      { error: "Rate limit exceeded. Maximum 3 backfills per hour." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }
  if (!entry || now >= entry.resetAt) {
    backfillRateLimit.set(uid, { count: 1, resetAt: now + 60 * 60 * 1000 });
  } else {
    entry.count++;
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { networkId, dateFrom, dateTo } = body as {
      networkId?: string;
      dateFrom?: string;
      dateTo?: string;
    };

    if (!networkId || !isValidNetworkId(networkId)) {
      return NextResponse.json({ error: "Valid networkId is required" }, { status: 400 });
    }

    const dateErr = validateDateRange(dateFrom || null, dateTo || null);
    if (dateErr) return NextResponse.json({ error: dateErr }, { status: 400 });

    // Fetch decrypted API key — key never logged or returned
    const apiKey = await getApiKey(uid, networkId);
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured for this network" }, { status: 400 });
    }

    let rawData: unknown;
    try {
      rawData = await fetchNetworkStats(networkId, apiKey, dateFrom!, dateTo!);
    } catch (fetchError) {
      // Audit log for failed backfill
      adminDb.collection("auditLogs").add({
        userId: uid,
        action: "backfill_failed",
        networkId,
        details: {
          dateFrom,
          dateTo,
          error: (fetchError as Error).message?.slice(0, 200) ?? "fetch failed",
          triggeredBy: "manual",
        },
        createdAt: FieldValue.serverTimestamp(),
      }).catch((err: Error) => console.error("Audit log write failed:", err));

      return NextResponse.json({
        error: "Failed to fetch data from network API",
        triggered: [],
        skipped: [],
        failed: [networkId],
      }, { status: 502 });
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
      const dateKey = (stat.date as string) || dateFrom!;
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
          syncedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      storedCount++;
    }

    if (storedCount > 0) await batch.commit();

    // Audit log — fire-and-forget, no API key data
    adminDb.collection("auditLogs").add({
      userId: uid,
      action: "backfill_completed",
      networkId,
      details: {
        dateFrom,
        dateTo,
        rowsFetched: statsArray.length,
        recordsStored: storedCount,
        triggeredBy: "manual",
      },
      createdAt: FieldValue.serverTimestamp(),
    }).catch((err: Error) => console.error("Audit log write failed:", err));

    return NextResponse.json({
      success: true,
      networkId,
      dateFrom,
      dateTo,
      rowsFetched: statsArray.length,
      recordsStored: storedCount,
      // Shape expected by useBackfill BackfillResult
      triggered: [networkId],
      skipped: [],
      failed: [],
    });
  } catch (error) {
    console.error("POST /api/stats/backfill error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
