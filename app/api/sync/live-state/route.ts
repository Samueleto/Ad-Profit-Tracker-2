import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin/admin";
import { verifyAuthToken } from "@/lib/firebase-admin/verify-token";
import { SUPPORTED_NETWORKS } from "@/lib/constants";
import { serializeDoc } from "@/lib/networks/network-helpers";
import type { NetworkId } from "@/lib/constants";

type OverallHealth = "healthy" | "degraded" | "critical";

interface NetworkSyncState {
  networkId: NetworkId;
  isActive: boolean;
  syncPhase: "idle" | "fetching" | "writing" | "complete" | "failed";
  lastSyncStatus: string;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  latestSyncedAt: string | null;
  latestDataDate: string | null;
  lastRowsFetched: number | null;
  lastLatencyMs: number | null;
  circuitBreakerOpen: boolean;
  circuitBreakerOpenedAt: string | null;
  lastErrorCode: string | null;
  retryCount: number;
  totalFailureCount: number;
  timeUntilNextScheduledSync: number | null;
}

function deriveHealth(networks: NetworkSyncState[]): OverallHealth {
  const failedCount = networks.filter(
    (n) => n.lastSyncStatus === "failed" || n.circuitBreakerOpen
  ).length;
  if (failedCount === 0) return "healthy";
  if (failedCount <= 1) return "degraded";
  return "critical";
}

export async function GET(request: Request) {
  const authResult = await verifyAuthToken(request);
  if ("error" in authResult) return authResult.error;
  const uid = authResult.token.uid;

  try {
    const networkStates: NetworkSyncState[] = await Promise.all(
      SUPPORTED_NETWORKS.map(async (networkId) => {
        // Fetch the last sync log
        const logsSnap = await adminDb
          .collection("auditLogs")
          .where("userId", "==", uid)
          .where("networkId", "==", networkId)
          .where("action", "in", ["sync_completed", "sync_failed"])
          .orderBy("createdAt", "desc")
          .limit(1)
          .get();

        const lastLog = logsSnap.empty
          ? null
          : (serializeDoc(logsSnap.docs[0]) as Record<string, unknown>);

        // Fetch circuit breaker state
        const cbDoc = await adminDb
          .collection("users")
          .doc(uid)
          .collection("circuitBreakers")
          .doc(networkId)
          .get();
        const cbData = cbDoc.exists ? (cbDoc.data() as Record<string, unknown>) : null;

        // Fetch retry state
        const retryDoc = await adminDb
          .collection("users")
          .doc(uid)
          .collection("retryState")
          .doc(networkId)
          .get();
        const retryData = retryDoc.exists
          ? (retryDoc.data() as Record<string, unknown>)
          : null;

        const lastSyncStatus = lastLog
          ? String(lastLog.action) === "sync_completed"
            ? "success"
            : "failed"
          : "never";

        const lastSyncedAt = lastLog
          ? String(lastLog.createdAt ?? "")
          : null;

        const cbOpen = cbData ? Boolean(cbData.isOpen) : false;
        const cbOpenedAt = cbData?.openedAt ? String(cbData.openedAt) : null;

        return {
          networkId,
          isActive: false,
          syncPhase: "idle" as const,
          lastSyncStatus,
          lastSyncedAt,
          lastSyncError: lastLog
            ? ((lastLog.details as Record<string, unknown>)?.error as string) ?? null
            : null,
          latestSyncedAt: lastSyncedAt,
          latestDataDate: lastLog
            ? ((lastLog.details as Record<string, unknown>)?.dateTo as string) ?? null
            : null,
          lastRowsFetched: lastLog
            ? Number(
                (lastLog.details as Record<string, unknown>)?.recordsStored ?? 0
              ) || null
            : null,
          lastLatencyMs: null,
          circuitBreakerOpen: cbOpen,
          circuitBreakerOpenedAt: cbOpenedAt,
          lastErrorCode: null,
          retryCount: retryData ? Number(retryData.retryCount ?? 0) : 0,
          totalFailureCount: retryData
            ? Number(retryData.totalFailureCount ?? 0)
            : 0,
          timeUntilNextScheduledSync: null,
        };
      })
    );

    const overallHealth = deriveHealth(networkStates);

    return NextResponse.json({
      overallHealth,
      networks: networkStates,
      polledAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("GET /api/sync/live-state error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
