import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { NetworkId } from "@/lib/constants";
import { getApiKey, createAuditLog, fetchNetworkStats, serializeDoc, NETWORK_API_CONFIGS } from "./network-helpers";

// GET /api/networks/{network}/stats
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
          return typeof d === 'string' && d <= dateTo;
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

// POST /api/networks/{network}/sync
export function makeSyncHandler(networkId: NetworkId) {
  return async function POST(request: Request) {
    const authResult = await verifyAuthToken(request);
    if ("error" in authResult) return authResult.error;
    const uid = authResult.token.uid;

    try {
      const body = await request.json().catch(() => ({}));
      const { dateFrom, dateTo } = body;

      const apiKey = await getApiKey(uid, networkId);
      if (!apiKey) {
        return NextResponse.json({ error: "API key not configured for this network" }, { status: 400 });
      }

      const syncDate = dateFrom || new Date().toISOString().split("T")[0];
      const endDate = dateTo || syncDate;

      let rawData: unknown;
      try {
        rawData = await fetchNetworkStats(networkId, apiKey, syncDate, endDate);
      } catch (fetchError) {
        await createAuditLog(uid, "sync_failed", networkId, {
          error: (fetchError as Error).message,
          dateFrom: syncDate,
          dateTo: endDate,
        });
        return NextResponse.json({ error: "Failed to fetch data from network API" }, { status: 502 });
      }

      // Store raw response for caching/debugging
      const rawRef = adminDb.collection("users").doc(uid).collection("rawResponses").doc(networkId);
      await rawRef.set({
        networkId,
        data: rawData,
        fetchedAt: FieldValue.serverTimestamp(),
        dateFrom: syncDate,
        dateTo: endDate,
      });

      // Parse and store stats
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
            rawData: stat,
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

// GET /api/networks/{network}/sync-status
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

      // Check if API key exists
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

// GET /api/networks/{network}/field-schema
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

// GET /api/networks/{network}/raw-response
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
        return NextResponse.json({ error: "No raw response available" }, { status: 404 });
      }

      return NextResponse.json(serializeDoc(rawDoc));
    } catch (error) {
      console.error(`GET /api/networks/${networkId}/raw-response error:`, error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}

// POST /api/networks/{network}/scheduled-sync
export function makeScheduledSyncHandler(networkId: NetworkId) {
  return async function POST(request: Request) {
    const authResult = await verifyAuthToken(request);
    if ("error" in authResult) return authResult.error;
    const uid = authResult.token.uid;

    try {
      const body = await request.json();
      const { cronExpression, enabled, dateRangeDays = 1 } = body;

      if (enabled !== false && !cronExpression) {
        return NextResponse.json({ error: "cronExpression is required when enabled is true" }, { status: 400 });
      }

      const scheduleRef = adminDb
        .collection("users")
        .doc(uid)
        .collection("scheduledSyncs")
        .doc(networkId);

      await scheduleRef.set({
        networkId,
        uid,
        cronExpression: cronExpression || null,
        enabled: enabled !== false,
        dateRangeDays,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      await createAuditLog(uid, "schedule_updated", networkId, { cronExpression, enabled });

      const updated = await scheduleRef.get();
      return NextResponse.json({ schedule: serializeDoc(updated) });
    } catch (error) {
      console.error(`POST /api/networks/${networkId}/scheduled-sync error:`, error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}
