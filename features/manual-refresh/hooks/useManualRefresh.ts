'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { SUPPORTED_NETWORKS, type NetworkId } from '@/lib/constants';
import type { SyncStatus } from '../components/SyncStatusBadge';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NetworkSyncState {
  networkId: NetworkId;
  lastSyncedAt: Date | null;
  lastSyncStatus: SyncStatus;
  lastSyncError: string | null;
}

interface RateLimitState {
  expiresAt: number; // epoch ms
  countdown: number; // seconds remaining
}

interface SyncHistoryEvent {
  id: string;
  networkId: string;
  status: SyncStatus;
  rowsFetched: number | null;
  latencyMs: number | null;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TERMINAL_STATUSES: SyncStatus[] = ['success', 'failed', 'never'];

// Strip anything resembling an API key or token (long alphanumeric strings 20+ chars)
const SENSITIVE_PATTERN = /[A-Za-z0-9_\-]{20,}/g;

function sanitizeErrorMessage(msg: string | null): string | null {
  if (!msg) return null;
  const truncated = msg.length > 200 ? msg.slice(0, 200) + '…' : msg;
  return truncated.replace(SENSITIVE_PATTERN, '[redacted]');
}

async function getToken(forceRefresh = false): Promise<string | null> {
  const auth = getAuth();
  return auth.currentUser?.getIdToken(forceRefresh) ?? null;
}

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  return fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

function makeInitialNetworkStates(): NetworkSyncState[] {
  return SUPPORTED_NETWORKS.map(n => ({
    networkId: n,
    lastSyncedAt: null,
    lastSyncStatus: 'never',
    lastSyncError: null,
  }));
}

type StatusNetworkPayload = {
  networkId: NetworkId;
  lastSyncedAt: string | null;
  lastSyncStatus: SyncStatus;
  lastSyncError?: string | null;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useManualRefresh() {
  const router = useRouter();
  const [networkStates, setNetworkStates] = useState<NetworkSyncState[]>(makeInitialNetworkStates());
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [initLoadError, setInitLoadError] = useState<string | null>(null);
  const [pollingStale, setPollingStale] = useState(false);
  const [triggeredNetworks, setTriggeredNetworks] = useState<Set<NetworkId>>(new Set());
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  // Rate limits: per-network and "all"
  const [networkRateLimits, setNetworkRateLimits] = useState<Partial<Record<NetworkId, RateLimitState>>>({});
  const [allRateLimit, setAllRateLimit] = useState<RateLimitState | null>(null);

  // History
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyData, setHistoryData] = useState<SyncHistoryEvent[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Polling refs
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggeredRef = useRef<Set<NetworkId>>(new Set());
  const consecutivePollFailuresRef = useRef(0);

  // Rate limit countdown intervals
  const allRateLimitTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const networkRateLimitTimers = useRef<Partial<Record<NetworkId, ReturnType<typeof setInterval>>>>({});

  // Keep triggeredRef in sync with triggeredNetworks state
  useEffect(() => {
    triggeredRef.current = triggeredNetworks;
  }, [triggeredNetworks]);

  // ─── Session expiry redirect ────────────────────────────────────────────────

  useEffect(() => {
    if (sessionExpired) {
      router.replace('/');
    }
  }, [sessionExpired, router]);

  /**
   * Handle 401: try a silent force-refresh first.
   * If the refresh gives us a new token, retry the original request.
   * If refresh fails, mark session expired (triggers redirect).
   */
  const retryAfter401 = useCallback(async (
    path: string,
    init: RequestInit = {}
  ): Promise<Response | null> => {
    try {
      const newToken = await getToken(true); // force refresh
      if (!newToken) { setSessionExpired(true); return null; }
      const retried = await fetch(path, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(init.headers as Record<string, string> ?? {}),
          Authorization: `Bearer ${newToken}`,
        },
      });
      if (retried.status === 401) { setSessionExpired(true); return null; }
      return retried;
    } catch {
      setSessionExpired(true);
      return null;
    }
  }, []);

  const handleResponseStatus = useCallback((status: number) => {
    if (status === 403) setAccessDenied(true);
    if (status === 401) setSessionExpired(true);
  }, []);

  // ─── Shared state update from status response ────────────────────────────

  const applyStatusResponse = useCallback((statuses: StatusNetworkPayload[]) => {
    setNetworkStates(prev => prev.map(n => {
      const found = statuses.find(s => s.networkId === n.networkId);
      if (!found) return n;
      return {
        ...n,
        lastSyncedAt: found.lastSyncedAt ? new Date(found.lastSyncedAt) : null,
        lastSyncStatus: found.lastSyncStatus,
        lastSyncError: sanitizeErrorMessage(found.lastSyncError ?? null),
      };
    }));

    if (triggeredRef.current.size > 0) {
      setTriggeredNetworks(prev => {
        const next = new Set(prev);
        statuses.forEach(s => {
          if (TERMINAL_STATUSES.includes(s.lastSyncStatus) && s.lastSyncStatus !== 'never') {
            next.delete(s.networkId as NetworkId);
          }
        });
        return next;
      });
    }
  }, []);

  // ─── Polling fetch (tracks consecutive failures → pollingStale) ──────────

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
    if (pollTimeoutRef.current) { clearTimeout(pollTimeoutRef.current); pollTimeoutRef.current = null; }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      let res = await authFetch('/api/scheduled/sync-status');

      if (res.status === 401) {
        const retried = await retryAfter401('/api/scheduled/sync-status');
        if (!retried) return;
        res = retried;
      }

      if (!res.ok) {
        handleResponseStatus(res.status);
        consecutivePollFailuresRef.current += 1;
        if (consecutivePollFailuresRef.current >= 3) {
          stopPolling();
          setPollingStale(true);
        }
        return;
      }

      // Success — reset failure counter
      consecutivePollFailuresRef.current = 0;
      setPollingStale(false);
      const data = await res.json();
      applyStatusResponse(data.networks ?? []);

    } catch {
      // Network error during poll
      consecutivePollFailuresRef.current += 1;
      if (consecutivePollFailuresRef.current >= 3) {
        stopPolling();
        setPollingStale(true);
      }
    }
  }, [retryAfter401, handleResponseStatus, stopPolling, applyStatusResponse]);

  // ─── Initial load with network-error backoff (2s, 4s, 8s) ───────────────

  const fetchStatusInitial = useCallback(async (): Promise<boolean> => {
    const DELAYS = [2000, 4000, 8000];

    const attempt = async (): Promise<'success' | 'network_error' | 'auth_error' | 'server_error'> => {
      try {
        let res = await authFetch('/api/scheduled/sync-status');
        if (res.status === 401) {
          const retried = await retryAfter401('/api/scheduled/sync-status');
          if (!retried) return 'auth_error';
          res = retried;
        }
        if (res.status === 403) { setAccessDenied(true); return 'auth_error'; }
        if (!res.ok) return 'server_error';
        const data = await res.json();
        applyStatusResponse(data.networks ?? []);
        setInitLoadError(null);
        return 'success';
      } catch {
        return 'network_error';
      }
    };

    let result = await attempt();
    if (result === 'success') return true;
    if (result === 'server_error') { setInitLoadError('Unable to load sync status'); return false; }
    if (result === 'auth_error') return false;

    // Network errors: retry with backoff
    for (let i = 0; i < DELAYS.length; i++) {
      setInitLoadError('No internet connection — retrying…');
      await new Promise(r => setTimeout(r, DELAYS[i]));
      result = await attempt();
      if (result === 'success') return true;
      if (result !== 'network_error') {
        if (result === 'server_error') setInitLoadError('Unable to load sync status');
        return false;
      }
    }

    setInitLoadError('No internet connection. Please check your network and try again.');
    return false;
  }, [retryAfter401, applyStatusResponse]);

  const retryInitialLoad = useCallback(() => {
    setInitLoadError(null);
    setIsInitialLoading(true);
    fetchStatusInitial().finally(() => setIsInitialLoading(false));
  }, [fetchStatusInitial]);

  // ─── Initial load ────────────────────────────────────────────────────────

  useEffect(() => {
    fetchStatusInitial().finally(() => setIsInitialLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Polling control ─────────────────────────────────────────────────────

  const startPolling = useCallback(() => {
    stopPolling();
    consecutivePollFailuresRef.current = 0;
    pollIntervalRef.current = setInterval(async () => {
      await fetchStatus();
      if (triggeredRef.current.size === 0) {
        stopPolling();
      }
    }, 3000);

    // Max 60s cap
    pollTimeoutRef.current = setTimeout(() => {
      stopPolling();
      setNetworkStates(prev => prev.map(n =>
        triggeredRef.current.has(n.networkId) ? { ...n, lastSyncStatus: 'failed' as SyncStatus } : n
      ));
      setTriggeredNetworks(new Set());
    }, 60000);
  }, [fetchStatus, stopPolling]);

  // Auto-start/stop polling based on triggered set
  useEffect(() => {
    if (triggeredNetworks.size > 0 && !pollIntervalRef.current) {
      startPolling();
    } else if (triggeredNetworks.size === 0 && pollIntervalRef.current) {
      stopPolling();
    }
  }, [triggeredNetworks, startPolling, stopPolling]);

  // ─── Cleanup on unmount ──────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      stopPolling();
      if (allRateLimitTimer.current) clearInterval(allRateLimitTimer.current);
      Object.values(networkRateLimitTimers.current).forEach(t => t && clearInterval(t));
    };
  }, [stopPolling]);

  // ─── Rate limit helpers ──────────────────────────────────────────────────

  const startAllRateLimitCountdown = (seconds: number) => {
    if (allRateLimitTimer.current) clearInterval(allRateLimitTimer.current);
    const expiresAt = Date.now() + seconds * 1000;
    setAllRateLimit({ expiresAt, countdown: seconds });
    allRateLimitTimer.current = setInterval(() => {
      setAllRateLimit(prev => {
        if (!prev || prev.countdown <= 1) {
          clearInterval(allRateLimitTimer.current!);
          allRateLimitTimer.current = null;
          return null;
        }
        return { ...prev, countdown: prev.countdown - 1 };
      });
    }, 1000);
  };

  const startNetworkRateLimitCountdown = (networkId: NetworkId, seconds: number) => {
    const existing = networkRateLimitTimers.current[networkId];
    if (existing) clearInterval(existing);
    const expiresAt = Date.now() + seconds * 1000;
    setNetworkRateLimits(prev => ({ ...prev, [networkId]: { expiresAt, countdown: seconds } }));
    networkRateLimitTimers.current[networkId] = setInterval(() => {
      setNetworkRateLimits(prev => {
        const cur = prev[networkId];
        if (!cur || cur.countdown <= 1) {
          clearInterval(networkRateLimitTimers.current[networkId]!);
          delete networkRateLimitTimers.current[networkId];
          const next = { ...prev };
          delete next[networkId];
          return next;
        }
        return { ...prev, [networkId]: { ...cur, countdown: cur.countdown - 1 } };
      });
    }, 1000);
  };

  // ─── Trigger helpers: parse POST response for per-network failures ────────

  type TriggerResponseBody = {
    triggered?: NetworkId[];
    failed?: Array<{ networkId: NetworkId; errorMessage?: string }>;
  };

  const applyTriggerResponse = (body: TriggerResponseBody, targetNetworks: NetworkId[]) => {
    const failedMap = new Map<NetworkId, string>(
      (body.failed ?? []).map(f => [f.networkId, sanitizeErrorMessage(f.errorMessage ?? 'Sync failed') ?? 'Sync failed'])
    );
    const failedIds = new Set(failedMap.keys());
    const successIds = targetNetworks.filter(id => !failedIds.has(id));

    // Update network states
    setNetworkStates(prev => prev.map(n => {
      if (failedIds.has(n.networkId)) {
        return { ...n, lastSyncStatus: 'failed' as SyncStatus, lastSyncError: failedMap.get(n.networkId) ?? 'Sync failed' };
      }
      if (successIds.includes(n.networkId)) {
        return { ...n, lastSyncStatus: 'in_progress' as SyncStatus, lastSyncError: null };
      }
      return n;
    }));

    // Only track non-failed networks for polling
    if (successIds.length > 0) {
      setTriggeredNetworks(prev => new Set([...prev, ...successIds]));
    }
  };

  // ─── Trigger actions ─────────────────────────────────────────────────────

  const triggerAll = useCallback(async () => {
    if (allRateLimit !== null) return;
    if (triggeredNetworks.size === SUPPORTED_NETWORKS.length) return;

    const path = '/api/networks/sync-all';
    const init: RequestInit = { method: 'POST', body: JSON.stringify({}) };

    try {
      let res = await authFetch(path, init);

      if (res.status === 401) {
        const retried = await retryAfter401(path, init);
        if (!retried) return;
        res = retried;
      }

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') ?? '60', 10);
        startAllRateLimitCountdown(isNaN(retryAfter) ? 60 : retryAfter);
        return;
      }
      if (!res.ok) {
        handleResponseStatus(res.status);
        if (res.status !== 403) {
          setTriggerError('Sync failed to start — please try again');
        }
        return;
      }

      // sync-all returns counts, not per-network arrays — treat all networks as triggered
      applyTriggerResponse({ triggered: SUPPORTED_NETWORKS as unknown as NetworkId[], failed: [] }, SUPPORTED_NETWORKS as unknown as NetworkId[]);
    } catch {
      setTriggerError('No internet connection. Please check your network and try again.');
    }
  }, [allRateLimit, triggeredNetworks, retryAfter401, handleResponseStatus, applyTriggerResponse]);

  const triggerNetwork = useCallback(async (networkId: NetworkId) => {
    if (networkRateLimits[networkId]) return;
    if (triggeredNetworks.has(networkId)) return;

    const path = '/api/sync/manual';
    const init: RequestInit = { method: 'POST', body: JSON.stringify({ networkId }) };

    try {
      let res = await authFetch(path, init);

      if (res.status === 401) {
        const retried = await retryAfter401(path, init);
        if (!retried) return;
        res = retried;
      }

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') ?? '60', 10);
        startNetworkRateLimitCountdown(networkId, isNaN(retryAfter) ? 60 : retryAfter);
        return;
      }
      if (!res.ok) {
        handleResponseStatus(res.status);
        if (res.status !== 403) {
          setTriggerError('Sync failed to start — please try again');
        }
        return;
      }

      const body: TriggerResponseBody = await res.json().catch(() => ({}));
      applyTriggerResponse(body, [networkId]);
    } catch {
      setTriggerError('No internet connection. Please check your network and try again.');
    }
  }, [networkRateLimits, triggeredNetworks, retryAfter401, handleResponseStatus]);

  // ─── History ─────────────────────────────────────────────────────────────

  const openHistory = useCallback(async () => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      let res = await authFetch('/api/scheduled/sync-history');
      if (res.status === 401) {
        const retried = await retryAfter401('/api/scheduled/sync-history');
        if (!retried) { setHistoryLoading(false); return; }
        res = retried;
      }
      if (!res.ok) {
        setHistoryError('Unable to load history — try again');
        return;
      }
      const data = await res.json();
      setHistoryData(data?.history ?? data?.events ?? []);
    } catch {
      setHistoryError('Unable to load history — try again');
    } finally {
      setHistoryLoading(false);
    }
  }, [retryAfter401]);

  const closeHistory = useCallback(() => {
    setHistoryOpen(false);
    setHistoryError(null);
  }, []);

  const retryHistory = useCallback(() => {
    openHistory();
  }, [openHistory]);

  // ─── Return ──────────────────────────────────────────────────────────────

  return {
    networkStates,
    isInitialLoading,
    initLoadError,
    pollingStale,
    retryInitialLoad,
    triggeredNetworks,
    triggerError,
    dismissTriggerError: () => setTriggerError(null),
    allRateLimit,
    networkRateLimits,
    triggerAll,
    triggerNetwork,
    historyOpen,
    historyLoading,
    historyData,
    historyError,
    openHistory,
    closeHistory,
    retryHistory,
    sessionExpired,
    accessDenied,
  };
}
