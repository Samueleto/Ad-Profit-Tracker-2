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

async function getToken(): Promise<string | null> {
  const auth = getAuth();
  return auth.currentUser?.getIdToken() ?? null;
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

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useManualRefresh() {
  const router = useRouter();
  const [networkStates, setNetworkStates] = useState<NetworkSyncState[]>(makeInitialNetworkStates());
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [triggeredNetworks, setTriggeredNetworks] = useState<Set<NetworkId>>(new Set());
  const [sessionExpired, setSessionExpired] = useState(false);

  // Rate limits: per-network and "all"
  const [networkRateLimits, setNetworkRateLimits] = useState<Partial<Record<NetworkId, RateLimitState>>>({});
  const [allRateLimit, setAllRateLimit] = useState<RateLimitState | null>(null);

  // History
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyData, setHistoryData] = useState<SyncHistoryEvent[]>([]);

  // Polling refs
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggeredRef = useRef<Set<NetworkId>>(new Set());

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

  const checkSessionExpiry = useCallback((status: number) => {
    if (status === 401) setSessionExpired(true);
  }, []);

  // ─── Fetch status ──────────────────────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    try {
      const res = await authFetch('/api/scheduled/sync-status');
      if (!res.ok) {
        checkSessionExpiry(res.status);
        return;
      }
      const data = await res.json();
      const statuses: Array<{
        networkId: NetworkId;
        lastSyncedAt: string | null;
        lastSyncStatus: SyncStatus;
        lastSyncError?: string | null;
      }> = data.networks ?? [];

      setNetworkStates(prev => prev.map(n => {
        const found = statuses.find(s => s.networkId === n.networkId);
        if (!found) return n;
        return {
          ...n,
          lastSyncedAt: found.lastSyncedAt ? new Date(found.lastSyncedAt) : null,
          lastSyncStatus: found.lastSyncStatus,
          lastSyncError: found.lastSyncError ?? null,
        };
      }));

      // Remove terminal networks from triggered set
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
    } catch {
      // Silently ignore polling errors
    }
  }, []);

  // ─── Initial load ──────────────────────────────────────────────────────────

  useEffect(() => {
    fetchStatus().finally(() => setIsInitialLoading(false));
  }, [fetchStatus]);

  // ─── Polling control ───────────────────────────────────────────────────────

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
    if (pollTimeoutRef.current) { clearTimeout(pollTimeoutRef.current); pollTimeoutRef.current = null; }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollIntervalRef.current = setInterval(async () => {
      await fetchStatus();
      // Stop if all triggered networks reached terminal status
      if (triggeredRef.current.size === 0) {
        stopPolling();
      }
    }, 3000);

    // Max 60s cap
    pollTimeoutRef.current = setTimeout(() => {
      stopPolling();
      // Mark any still-in-progress as failed after timeout
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

  // ─── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      stopPolling();
      if (allRateLimitTimer.current) clearInterval(allRateLimitTimer.current);
      Object.values(networkRateLimitTimers.current).forEach(t => t && clearInterval(t));
    };
  }, [stopPolling]);

  // ─── Rate limit helpers ────────────────────────────────────────────────────

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

  // ─── Trigger actions ───────────────────────────────────────────────────────

  const triggerAll = useCallback(async () => {
    if (allRateLimit !== null) return;
    // Don't re-trigger networks already in progress
    const alreadyRunning = Array.from(triggeredNetworks);
    if (alreadyRunning.length === SUPPORTED_NETWORKS.length) return;

    const res = await authFetch('/api/sync/manual', { method: 'POST', body: JSON.stringify({}) });

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') ?? '60', 10);
      startAllRateLimitCountdown(isNaN(retryAfter) ? 60 : retryAfter);
      return;
    }
    if (!res.ok) { checkSessionExpiry(res.status); return; }

    setNetworkStates(prev => prev.map(n => ({
      ...n,
      lastSyncStatus: 'in_progress' as SyncStatus,
      lastSyncError: null,
    })));
    setTriggeredNetworks(new Set(SUPPORTED_NETWORKS as unknown as NetworkId[]));
  }, [allRateLimit, triggeredNetworks]);

  const triggerNetwork = useCallback(async (networkId: NetworkId) => {
    if (networkRateLimits[networkId]) return;
    if (triggeredNetworks.has(networkId)) return;

    const res = await authFetch('/api/sync/manual', {
      method: 'POST',
      body: JSON.stringify({ networkId }),
    });

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') ?? '60', 10);
      startNetworkRateLimitCountdown(networkId, isNaN(retryAfter) ? 60 : retryAfter);
      return;
    }
    if (!res.ok) { checkSessionExpiry(res.status); return; }

    setNetworkStates(prev => prev.map(n =>
      n.networkId === networkId
        ? { ...n, lastSyncStatus: 'in_progress' as SyncStatus, lastSyncError: null }
        : n
    ));
    setTriggeredNetworks(prev => new Set([...prev, networkId]));
  }, [networkRateLimits, triggeredNetworks]);

  // ─── History ───────────────────────────────────────────────────────────────

  const openHistory = useCallback(async () => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const res = await authFetch('/api/scheduled/sync-history');
      const data = res.ok ? await res.json() : null;
      setHistoryData(data?.history ?? data?.events ?? []);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const closeHistory = useCallback(() => {
    setHistoryOpen(false);
  }, []);

  // ─── Return ────────────────────────────────────────────────────────────────

  return {
    networkStates,
    isInitialLoading,
    triggeredNetworks,
    allRateLimit,
    networkRateLimits,
    triggerAll,
    triggerNetwork,
    historyOpen,
    historyLoading,
    historyData,
    openHistory,
    closeHistory,
    sessionExpired,
  };
}
