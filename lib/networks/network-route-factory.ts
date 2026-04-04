import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { verifyInternalSecret } from "@/lib/firebase-admin/verify-internal-secret";
import { NetworkId } from "@/lib/constants";
import { getApiKey, createAuditLog, fetchNetworkStats, serializeDoc, NETWORK_API_CONFIGS } from "./network-helpers";

// ─── Shared helpers ───────────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 90;

function validateDateRange(
  dateFrom: string | null,
  dateTo: string | null
): string | null {
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

// Sensitive field names to strip from raw API responses before storing
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

// In-memory rate limit: 10 manual syncs per hour per uid (per network)
const syncRateLimit = new Map<string, { count: number; resetAt: number }>();

function checkSyncRateLimit(uid: string, networkId: NetworkId): boolean {
  const key = `${uid}_${networkId}`;
  const now = Date.now();
  const entry = syncRateLimit.get(key);
  if (!entry || now >= entry.resetAt) {
    syncRateLimit.set(key, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

// ─── GET /api/networks/{network}/stats ────────────────────────────────────────

export function makeStatsHandler(networkId: NetworkId) {
  return async function GET(request: Request) {
    const authResult = await verifyAuthToken(request);
    if ("error" in authResult) return authResult.error;
    const uid = authResult.token.uid;

    try {
      const { searchParams } = new URL(request.url);
      const dateFrom = searchParams.get("dateFrom");
      const dateTo = searchParams.get("dateTo");
      const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);

      // Date validation
      const dateErr = validateDateRange(dateFrom, dateTo);
      if (dateErr) return NextResponse.json({ error: dateErr }, { status: 400 });

      let query = adminDb
        .collection("adStats")
        .where("uid", "==", uid)
        .where("networkId", "==", networkId)
        .orderBy("date", "desc")
        .limit(limit);

      if (dateFrom) {
        query = adminDb
          .collection("adStats")
          .where("uid", "==", uid)
          .where("networkId", "==", networkId)
          .where("date", ">=", dateFrom)
          .orderBy("date", "desc")
          .limit(limit);
      }

      const snapshot = await query.get();
      let stats = snapshot.docs.map(serializeDoc);

      if (dateTo) {
        stats = stats.filter((s) => {
          const d = s && (s as Record<string, unknown>).date;
          return typeof d === "string" && d <= dateTo;
        });
      }

      const totals = stats.reduce(
        (acc: { impressions: number; clicks: number; revenue: number; cost: number }, s) => {
          if (!s) return acc;
          const row = s as Record<string, unknown>;
          acc.impressions += Number(row.impressions) || 0;
          acc.clicks += Number(row.clicks) || 0;
          acc.revenue += Number(row.revenue) || 0;
          acc.cost += Number(row.cost) || 0;
          return acc;
        },
        { impressions: 0, clicks: 0, revenue: 0, cost: 0 }
      );

      return NextResponse.json({ stats, totals, networkId });
    } catch (error) {
      console.error(`GET /api/networks/${networkId}/stats error:`, error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}

// ─── POST /api/networks/{network}/sync ───────────────────────────────────────

export function makeSyncHandler(networkId: NetworkId) {
  return async function POST(request: Request) {
    const authResult = await verifyAuthToken(request);
    if ("error" in authResult) return authResult.error;
    const uid = authResult.token.uid;

    // Rate limit: 10 manual syncs per hour per uid per network
    if (!checkSyncRateLimit(uid, networkId)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Maximum 10 manual syncs per hour." },
        { status: 429 }
      );
    }

    try {
      const body = await request.json().catch(() => ({}));
      const { dateFrom, dateTo } = body;

      // Date validation
      const dateErr = validateDateRange(dateFrom || null, dateTo || null);
      if (dateErr) return NextResponse.json({ error: dateErr }, { status: 400 });

      const apiKey = await getApiKey(uid, networkId);
      if (!apiKey) {
        return NextResponse.json(
          { error: "no_api_key", message: "No API key configured for this network. Add one in settings." },
          { status: 404 }
        );
      }

      const syncDate = dateFrom || new Date().toISOString().split("T")[0];
      const endDate = dateTo || syncDate;

      let rawData: unknown;
      try {
        rawData = await fetchNetworkStats(networkId, apiKey, syncDate, endDate);
      } catch (fetchError) {
        const errMsg = (fetchError as Error).message;
        // Update networkConfig with failed status — best effort, don't block response
        adminDb
          .collection("users").doc(uid).collection("networkConfigs").doc(networkId)
          .update({ lastSyncStatus: "failed", lastSyncError: errMsg })
          .catch(() => {});
        await createAuditLog(uid, "sync_failed", networkId, {
          error: errMsg,
          dateFrom: syncDate,
          dateTo: endDate,
        });
        return NextResponse.json(
          { error: "network_api_error", message: `${networkId} API returned an error — please try again later.` },
          { status: 502 }
        );
      }

      // Sanitize raw response — strip fields with sensitive names before storing
      const sanitizedRaw = sanitizeRawResponse(rawData);

      // Store sanitized raw response
      const rawRef = adminDb.collection("users").doc(uid).collection("rawResponses").doc(networkId);
      await rawRef.set({
        networkId,
        data: sanitizedRaw,
        fetchedAt: FieldValue.serverTimestamp(),
        dateFrom: syncDate,
        dateTo: endDate,
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
        const dateKey = (stat.date as string) || syncDate;
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
            // Never store the raw API response in adStats — only aggregated fields
            syncedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        storedCount++;
      }

      if (storedCount > 0) await batch.commit();

      await createAuditLog(uid, "sync_completed", networkId, {
        dateFrom: syncDate,
        dateTo: endDate,
        recordsStored: storedCount,
      });

      return NextResponse.json({
        success: true,
        networkId,
        recordsStored: storedCount,
        dateFrom: syncDate,
        dateTo: endDate,
      });
    } catch (error) {
      console.error(`POST /api/networks/${networkId}/sync error:`, error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}

// ─── GET /api/networks/{network}/sync-status ──────────────────────────────────

export function makeSyncStatusHandler(networkId: NetworkId) {
  return async function GET(request: Request) {
    const authResult = await verifyAuthToken(request);
    if ("error" in authResult) return authResult.error;
    const uid = authResult.token.uid;

    try {
      const logsSnapshot = await adminDb
        .collection("auditLogs")
        .where("uid", "==", uid)
        .where("networkId", "==", networkId)
        .where("action", "in", ["sync_completed", "sync_failed", "sync_triggered"])
        .orderBy("timestamp", "desc")
        .limit(10)
        .get();

      const logs = logsSnapshot.docs.map(serializeDoc);
      const lastSync = logs[0] || null;
      const lastSuccess = logs.find((l) => l?.action === "sync_completed") || null;

      const keyDoc = await adminDb
        .collection("users")
        .doc(uid)
        .collection("apiKeys")
        .doc(networkId)
        .get();

      return NextResponse.json({
        networkId,
        hasApiKey: keyDoc.exists && !!keyDoc.data()?.encryptedKey,
        lastSync,
        lastSuccess,
        recentLogs: logs,
      });
    } catch (error) {
      console.error(`GET /api/networks/${networkId}/sync-status error:`, error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}

// ─── GET /api/networks/{network}/field-schema ─────────────────────────────────

export function makeFieldSchemaHandler(networkId: NetworkId) {
  return async function GET(request: Request) {
    const authResult = await verifyAuthToken(request);
    if ("error" in authResult) return authResult.error;

    return NextResponse.json({
      networkId,
      schema: NETWORK_API_CONFIGS[networkId].fieldSchema,
    });
  };
}

// ─── GET /api/networks/{network}/raw-response ─────────────────────────────────

export function makeRawResponseHandler(networkId: NetworkId) {
  return async function GET(request: Request) {
    const authResult = await verifyAuthToken(request);
    if ("error" in authResult) return authResult.error;
    const uid = authResult.token.uid;

    try {
      const rawDoc = await adminDb
        .collection("users")
        .doc(uid)
        .collection("rawResponses")
        .doc(networkId)
        .get();

      if (!rawDoc.exists) {
        return NextResponse.json(
          { error: "no_data_for_date", message: "No data found for this date. Try syncing this date range first." },
          { status: 404 }
        );
      }

      return NextResponse.json(serializeDoc(rawDoc));
    } catch (error) {
      console.error(`GET /api/networks/${networkId}/raw-response error:`, error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}

// ─── POST /api/networks/{network}/scheduled-sync (INTERNAL ONLY) ──────────────
// Called exclusively by Cloud Scheduler via x-internal-secret.
// Firebase user tokens are NOT accepted on this endpoint.

export function makeScheduledSyncHandler(networkId: NetworkId) {
  return async function POST(request: Request) {
    // Reject any request that carries a Firebase Bearer token
    if (request.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authError = verifyInternalSecret(request);
    if (authError) return authError;

    try {
      // Find all users with active schedules for this network
      const usersSnapshot = await adminDb.collection("users").get();
      const results: { uid: string; status: string; records?: number }[] = [];

      for (const userDoc of usersSnapshot.docs) {
        const uid = userDoc.id;
        const scheduleDoc = await adminDb
          .collection("users")
          .doc(uid)
          .collection("scheduledSyncs")
          .doc(networkId)
          .get();

        if (!scheduleDoc.exists || !scheduleDoc.data()?.enabled) continue;

        const schedule = scheduleDoc.data()!;
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
          results.push({ uid, status: "error_decryption" });
          continue;
        }

        if (!apiKey) {
          results.push({ uid, status: "skipped_no_key" });
          continue;
        }

        let rawData: unknown;
        try {
          rawData = await fetchNetworkStats(networkId, apiKey, dateFrom, dateTo);
        } catch (fetchError) {
          await createAuditLog(uid, "sync_failed", networkId, {
            error: (fetchError as Error).message?.slice(0, 200) ?? "fetch failed",
            triggeredBy: "scheduled",
          });
          results.push({ uid, status: "error_fetch" });
          continue;
        }

        const sanitizedRaw = sanitizeRawResponse(rawData);
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

        // Store sanitized raw response separately
        await adminDb.collection("users").doc(uid).collection("rawResponses").doc(networkId).set({
          networkId,
          data: sanitizedRaw,
          fetchedAt: FieldValue.serverTimestamp(),
          dateFrom,
          dateTo,
        });

        await createAuditLog(uid, "sync_completed", networkId, {
          dateFrom,
          dateTo,
          recordsStored: storedCount,
          triggeredBy: "scheduled",
        });

        results.push({ uid, status: "ok", records: storedCount });
      }

      return NextResponse.json({
        networkId,
        synced: results.filter((r) => r.status === "ok").length,
        errors: results.filter((r) => r.status.startsWith("error")).length,
        skipped: results.filter((r) => r.status.startsWith("skipped")).length,
      });
    } catch (error) {
      console.error(`POST /api/networks/${networkId}/scheduled-sync error:`, error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}
