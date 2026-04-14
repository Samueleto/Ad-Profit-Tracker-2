'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScheduledNetworkStatus {
  networkId: string;
  isActive: boolean;
  syncSchedule: string;
  lastSyncedAt: string | null;
  lastSyncStatus: 'success' | 'failed' | 'partial' | 'never';
  lastSyncError: string | null;
  latestDataDate: string | null;
  nextScheduledSync: string | null;
}

export interface SyncStatusResponse {
  networks: ScheduledNetworkStatus[];
  lastMasterSyncAt: string | null;
}

export interface SyncHistoryEntry {
  id: string;
  networkId: string;
  status: 'success' | 'failed' | 'partial';
  triggeredBy: 'scheduler' | 'user';
  triggeredAt: string;
  completedAt: string | null;
  rowsFetched: number | null;
  latencyMs: number | null;
  errorMessage: string | null;
}

// ─── Shared auth helper ───────────────────────────────────────────────────────

async function getHeaders(forceRefresh = false): Promise<Record<string, string>> {
  const token = await getAuth().currentUser?.getIdToken(forceRefresh);
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const doRequest = async (forceRefresh: boolean) => {
    const headers = await getHeaders(forceRefresh);
    return fetch(path, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> ?? {}) } });
  };
  let res = await doRequest(false);
  if (res.status === 401) {
    res = await doRequest(true);
    if (res.status === 401) {
      toast.error('Session expired. Please sign in again.');
      window.location.replace('/');
      throw new Error('Session expired.');
    }
  }
  return res;
}

const POLL_INTERVAL_MS = 30_000;

// ─── useSyncStatus ────────────────────────────────────────────────────────────

export interface UseSyncStatusResult {
  networks: ScheduledNetworkStatus[];
  lastMasterSyncAt: string | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useSyncStatus(): UseSyncStatusResult {
  const [networks, setNetworks] = useState<ScheduledNetworkStatus[]>([]);
  const [lastMasterSyncAt, setLastMasterSyncAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const mountedRef = useRef(true);

  const doFetch = useCallback(async () => {
    try {
      const res = await authFetch('/api/scheduled/sync-status');
      if (!mountedRef.current) return;
      if (!res.ok) { setError(`Failed to load sync status (${res.status}).`); return; }
      const data: SyncStatusResponse = await res.json();
      setNetworks(data.networks ?? []);
      setLastMasterSyncAt(data.lastMasterSyncAt ?? null);
      setError(null);
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    doFetch();
    return () => { mountedRef.current = false; };
  }, [doFetch]);

  // 30s polling
  useEffect(() => {
    if (tick === 0) return;
    doFetch();
  }, [tick, doFetch]);

  useEffect(() => {
    const id = setInterval(() => setTick(n => n + 1), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const refresh = useCallback(() => { doFetch(); }, [doFetch]);

  return { networks, lastMasterSyncAt, isLoading, error, refresh };
}

// ─── useSyncHistory ───────────────────────────────────────────────────────────

export interface UseSyncHistoryResult {
  history: SyncHistoryEntry[];
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
  loadMore: () => void;
}

export function useSyncHistory(networkId?: string, limit = 10): UseSyncHistoryResult {
  const [history, setHistory] = useState<SyncHistoryEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadMoreTrigger, setLoadMoreTrigger] = useState(0);
  const cappedLimit = Math.min(limit, 50);

  const fetchPage = useCallback(async (currentCursor: string | null, append: boolean) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(cappedLimit) });
      if (networkId) params.set('networkId', networkId);
      if (currentCursor) params.set('cursor', currentCursor);
      const res = await authFetch(`/api/scheduled/sync-history?${params}`);
      if (!res.ok) { setError(`Failed to load sync history (${res.status}).`); return; }
      const data = await res.json();
      const entries: SyncHistoryEntry[] = data.history ?? [];
      if (append) setHistory(prev => [...prev, ...entries]);
      else setHistory(entries);
      setHasMore(data.hasMore ?? !!data.nextCursor);
      setCursor(data.nextCursor ?? null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setIsLoading(false);
    }
  }, [networkId, cappedLimit]);

  // Initial fetch on mount or filter change
  useEffect(() => {
    setHistory([]);
    setCursor(null);
    fetchPage(null, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [networkId, cappedLimit]);

  // Load more
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;
  useEffect(() => {
    if (loadMoreTrigger === 0) return;
    fetchPage(cursorRef.current, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadMoreTrigger]);

  const loadMore = useCallback(() => {
    if (!hasMore || isLoading) return;
    setLoadMoreTrigger(n => n + 1);
  }, [hasMore, isLoading]);

  return { history, hasMore, isLoading, error, loadMore };
}

// ─── useRetrySync ─────────────────────────────────────────────────────────────

export interface RetryResult {
  networkId: string;
  status: string;
  message?: string;
}

export interface UseRetrySyncResult {
  retryNetwork: (networkId: string) => Promise<void>;
  isRetrying: Set<string>;
  retryError: Record<string, string>;
  retryResult: Record<string, RetryResult>;
  clearRetry: (networkId: string) => void;
}

export function useRetrySync(onSuccess?: () => void): UseRetrySyncResult {
  const [isRetrying, setIsRetrying] = useState<Set<string>>(new Set());
  const [retryError, setRetryError] = useState<Record<string, string>>({});
  const [retryResult, setRetryResult] = useState<Record<string, RetryResult>>({});

  const retryNetwork = useCallback(async (networkId: string) => {
    setIsRetrying(prev => new Set(prev).add(networkId));
    setRetryError(prev => { const n = { ...prev }; delete n[networkId]; return n; });
    try {
      const res = await authFetch('/api/scheduled/retry-failed', {
        method: 'POST',
        body: JSON.stringify({ networkId }),
      });
      if (res.status === 429) {
        setRetryError(prev => ({ ...prev, [networkId]: 'Rate limit reached — try again in an hour' }));
        return;
      }
      if (res.status === 404) {
        setRetryError(prev => ({ ...prev, [networkId]: 'No API key saved for this network — add one in settings' }));
        return;
      }
      if (res.status === 502) {
        setRetryError(prev => ({ ...prev, [networkId]: 'The network API is currently unreachable — try again later' }));
        return;
      }
      if (res.status === 400) {
        const data = await res.json().catch(() => ({}));
        const msg = typeof data?.error === 'string' && data.error.toLowerCase().includes('no failed sync')
          ? "This network doesn't have a failed sync to retry"
          : data?.error ?? 'Bad request';
        setRetryError(prev => ({ ...prev, [networkId]: msg }));
        return;
      }
      if (res.status === 500 || !res.ok) {
        setRetryError(prev => ({ ...prev, [networkId]: 'Something went wrong on our end — please try again' }));
        return;
      }
      const result = await res.json();
      setRetryResult(prev => ({ ...prev, [networkId]: result }));
      onSuccess?.();
    } catch (err) {
      setRetryError(prev => ({ ...prev, [networkId]: err instanceof Error ? err.message : 'Network error.' }));
    } finally {
      setIsRetrying(prev => { const n = new Set(prev); n.delete(networkId); return n; });
    }
  }, [onSuccess]);

  const clearRetry = useCallback((networkId: string) => {
    setRetryError(prev => { const n = { ...prev }; delete n[networkId]; return n; });
    setRetryResult(prev => { const n = { ...prev }; delete n[networkId]; return n; });
  }, []);

  return { retryNetwork, isRetrying, retryError, retryResult, clearRetry };
}
