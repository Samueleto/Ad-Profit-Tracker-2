'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import type { NetworkSyncState, ActivityFeedEntry, OverallHealth, LiveStateResponse } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CriticalAnomaly {
  id: string;
  networkId: string;
  severity: string;
  type: string;
  message: string;
  detectedAt: string;
}

type ErrorType = '401' | '403' | '500' | 'network';

interface SyncError {
  type: ErrorType;
  message: string;
}

export interface UseSyncStatusResult {
  networks: NetworkSyncState[];
  overallHealth: OverallHealth;
  activityFeed: ActivityFeedEntry[];
  criticalAnomalies: CriticalAnomaly[];
  isLoading: boolean;
  error: SyncError | null;
  sessionExpired: boolean;
  pollingPaused: boolean;
  lastPolledAt: Date | null;
  refresh: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getToken(): Promise<string | null> {
  try {
    const auth = getAuth();
    return await (auth.currentUser?.getIdToken() ?? Promise.resolve(null));
  } catch {
    return null;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSyncStatus(): UseSyncStatusResult {
  const [networks, setNetworks] = useState<NetworkSyncState[]>([]);
  const [overallHealth, setOverallHealth] = useState<OverallHealth>('healthy');
  const [activityFeed, setActivityFeed] = useState<ActivityFeedEntry[]>([]);
  const [criticalAnomalies, setCriticalAnomalies] = useState<CriticalAnomaly[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<SyncError | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [pollingPaused, setPollingPaused] = useState(false);
  const [lastPolledAt, setLastPolledAt] = useState<Date | null>(null);

  const isMountedRef = useRef(true);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentIntervalRef = useRef<number>(30000);
  const abortControllerRef = useRef<AbortController | null>(null);
  // Only fetch anomalies every 5th poll to reduce Firestore read costs
  const pollCountRef = useRef<number>(0);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const fetchAll = useCallback(async (): Promise<NetworkSyncState[] | null> => {
    if (!isMountedRef.current) return null;

    // Cancel any previous in-flight requests
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;

    const token = await getToken();
    if (!token) {
      if (isMountedRef.current) {
        setSessionExpired(true);
        setError({ type: '401', message: 'Session expired. Please sign in again.' });
        stopPolling();
      }
      return null;
    }

    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };

    try {
      pollCountRef.current += 1;
      const fetchAnomalies = pollCountRef.current % 5 === 1; // fetch on 1st, 6th, 11th… poll

      // Parallel fetch: live-state, activity-feed, and anomalies (every 5th poll)
      const [liveRes, activityRes, anomaliesRes] = await Promise.all([
        fetch('/api/sync/live-state', { headers, signal }),
        fetch('/api/sync/activity-feed?limit=5', { headers, signal }),
        fetchAnomalies
          ? fetch('/api/reconciliation/anomalies', { headers, signal }).catch(() => null)
          : Promise.resolve(null),
      ]);

      if (!isMountedRef.current) return null;

      // Handle 401 / 403 / 500 from primary endpoint
      if (liveRes.status === 401) {
        setSessionExpired(true);
        setError({ type: '401', message: 'Session expired. Please sign in again.' });
        stopPolling();
        return null;
      }
      if (liveRes.status === 403) {
        setError({ type: '403', message: 'Access denied.' });
        stopPolling();
        return null;
      }
      if (!liveRes.ok) {
        setError({ type: '500', message: `Server error (${liveRes.status})` });
        setPollingPaused(true);
        stopPolling();
        return null;
      }

      const liveData: LiveStateResponse = await liveRes.json();
      setNetworks(liveData.networks);
      setOverallHealth(liveData.overallHealth);
      setError(null);
      setLastPolledAt(new Date());

      // Activity feed (best-effort)
      if (activityRes?.ok) {
        const actData = await activityRes.json();
        setActivityFeed(actData?.feed ?? []);
      }

      // Anomalies (best-effort — don't fail whole panel if this fails)
      if (anomaliesRes?.ok) {
        const anomalyData = await anomaliesRes.json();
        const critical = (anomalyData?.anomalies ?? []).filter(
          (a: { severity: string }) => a.severity === 'critical'
        );
        setCriticalAnomalies(critical);
      }
      // If anomalies failed, leave as empty array (already initialized)

      return liveData.networks;
    } catch (err) {
      if (!isMountedRef.current) return null;
      if (err instanceof Error && err.name === 'AbortError') return null;
      setError({ type: 'network', message: 'Network error. Retrying…' });
      // Keep polling on network errors
      return null;
    }
  }, [stopPolling]);

  const startPolling = useCallback(
    (nets: NetworkSyncState[]) => {
      stopPolling();
      const hasActive = nets.some(n => n.syncPhase === 'fetching' || n.syncPhase === 'writing');
      const interval = hasActive ? 5000 : 30000;
      currentIntervalRef.current = interval;

      pollIntervalRef.current = setInterval(async () => {
        const updatedNetworks = await fetchAll();
        if (!isMountedRef.current || !updatedNetworks) return;

        const stillActive = updatedNetworks.some(
          n => n.syncPhase === 'fetching' || n.syncPhase === 'writing'
        );
        const newInterval = stillActive ? 5000 : 30000;

        // Reset interval if rate changed
        if (newInterval !== currentIntervalRef.current) {
          startPolling(updatedNetworks);
        }
      }, interval);
    },
    [fetchAll, stopPolling]
  );

  const refresh = useCallback(() => {
    setPollingPaused(false);
    setError(null);
    fetchAll().then(nets => {
      if (nets && isMountedRef.current) startPolling(nets);
    });
  }, [fetchAll, startPolling]);

  // Initial load + polling setup
  useEffect(() => {
    isMountedRef.current = true;

    fetchAll().then(nets => {
      if (!isMountedRef.current) return;
      setIsLoading(false);
      if (nets) startPolling(nets);
    });

    return () => {
      isMountedRef.current = false;
      stopPolling();
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    networks,
    overallHealth,
    activityFeed,
    criticalAnomalies,
    isLoading,
    error,
    sessionExpired,
    pollingPaused,
    lastPolledAt,
    refresh,
  };
}
