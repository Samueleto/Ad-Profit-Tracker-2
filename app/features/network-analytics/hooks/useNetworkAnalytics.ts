'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAuth } from 'firebase/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NetworkId = 'exoclick' | 'rollerads' | 'zeydoo' | 'propush';
export type LoadingState = 'idle' | 'loading' | 'success' | 'error' | 'empty';

export interface NetworkData {
  summary: unknown;
  series: unknown[];
  countries: unknown[];
  networkStatus: unknown;
  loadingState: LoadingState;
  error: string | null;
  loadedForDateRange: string | null;
}

const NETWORKS: NetworkId[] = ['exoclick', 'rollerads', 'zeydoo', 'propush'];

function emptyNetworkData(): NetworkData {
  return { summary: null, series: [], countries: [], networkStatus: null, loadingState: 'idle', error: null, loadedForDateRange: null };
}

function initialCache(): Record<NetworkId, NetworkData> {
  return Object.fromEntries(NETWORKS.map(id => [id, emptyNetworkData()])) as Record<NetworkId, NetworkData>;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function fetchWithAuth<T>(path: string, forceRefresh = false): Promise<T> {
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken(forceRefresh);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res = await fetch(path, { headers });
  if (res.status === 401 && !forceRefresh) {
    const freshToken = await auth.currentUser?.getIdToken(true);
    const retryHeaders = { ...headers, ...(freshToken ? { Authorization: `Bearer ${freshToken}` } : {}) };
    res = await fetch(path, { headers: retryHeaders });
  }
  if (!res.ok) {
    const err = new Error(`Request failed: ${res.status}`);
    (err as Error & { status: number }).status = res.status;
    throw err;
  }
  return res.json();
}

// ─── useNetworkAnalytics ──────────────────────────────────────────────────────

export interface UseNetworkAnalyticsResult {
  cache: Record<NetworkId, NetworkData>;
  activeTab: NetworkId;
  setActiveTab: (id: NetworkId) => void;
  syncNetwork: (networkId: NetworkId) => Promise<void>;
}

export function useNetworkAnalytics(dateFrom: string, dateTo: string): UseNetworkAnalyticsResult {
  const [cache, setCache] = useState<Record<NetworkId, NetworkData>>(initialCache);
  const [activeTab, setActiveTabState] = useState<NetworkId>('exoclick');
  const loadingRef = useRef<Set<NetworkId>>(new Set());
  const dateRangeKey = `${dateFrom}|${dateTo}`;

  const loadNetwork = useCallback(async (networkId: NetworkId, df: string, dt: string) => {
    const key = `${df}|${dt}`;
    if (loadingRef.current.has(networkId)) return;
    loadingRef.current.add(networkId);

    setCache(prev => ({
      ...prev,
      [networkId]: { ...prev[networkId], loadingState: 'loading', error: null },
    }));

    try {
      const baseParams = new URLSearchParams({ networkId, dateFrom: df, dateTo: dt });
      const [totalData, dailyData, countryData] = await Promise.all([
        fetchWithAuth(`/api/networks/stats?${new URLSearchParams({ ...Object.fromEntries(baseParams), groupBy: 'total' })}`),
        fetchWithAuth(`/api/networks/stats?${new URLSearchParams({ ...Object.fromEntries(baseParams), groupBy: 'daily' })}`),
        fetchWithAuth(`/api/networks/stats?${new URLSearchParams({ ...Object.fromEntries(baseParams), groupBy: 'country' })}`),
      ]);

      const summary = (totalData as Record<string, unknown>)?.summary ?? totalData;
      const series = ((dailyData as Record<string, unknown>)?.series as unknown[]) ?? [];
      const countries = ((countryData as Record<string, unknown>)?.countries as unknown[]) ?? [];

      setCache(prev => ({
        ...prev,
        [networkId]: {
          summary,
          series,
          countries,
          networkStatus: (totalData as Record<string, unknown>)?.networkStatus ?? null,
          loadingState: !series.length && !countries.length ? 'empty' : 'success',
          error: null,
          loadedForDateRange: key,
        },
      }));
    } catch (err) {
      setCache(prev => ({
        ...prev,
        [networkId]: {
          ...prev[networkId],
          loadingState: 'error',
          error: err instanceof Error ? err.message : 'Failed to load network data.',
          loadedForDateRange: null,
        },
      }));
    } finally {
      loadingRef.current.delete(networkId);
    }
  }, []);

  // Invalidate cache when date range changes
  useEffect(() => {
    if (!dateFrom || !dateTo) return;
    setCache(prev => {
      const next = { ...prev };
      for (const id of NETWORKS) {
        if (next[id].loadedForDateRange !== dateRangeKey) {
          next[id] = { ...next[id], loadedForDateRange: null };
        }
      }
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  // Load active tab when it becomes active or date range changes
  useEffect(() => {
    if (!dateFrom || !dateTo) return;
    const entry = cache[activeTab];
    if (entry.loadedForDateRange === dateRangeKey) return; // already loaded for this range
    loadNetwork(activeTab, dateFrom, dateTo);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, dateFrom, dateTo]);

  const setActiveTab = useCallback((id: NetworkId) => {
    setActiveTabState(id);
  }, []);

  const syncNetwork = useCallback(async (networkId: NetworkId) => {
    await fetchWithAuth('/api/sync/manual', false);
    // Invalidate and re-fetch
    setCache(prev => ({ ...prev, [networkId]: { ...prev[networkId], loadedForDateRange: null } }));
    await loadNetwork(networkId, dateFrom, dateTo);
  }, [dateFrom, dateTo, loadNetwork]);

  return { cache, activeTab, setActiveTab, syncNetwork };
}

// ─── useApiExplorer ───────────────────────────────────────────────────────────

export interface NetworkRawState {
  data: unknown;
  loading: boolean;
  loaded: boolean;
  error: string | null;
  hasApiKey: boolean;
  testResult: unknown;
  testing: boolean;
}

const RAW_ENDPOINTS: Record<NetworkId, string> = {
  exoclick: '/api/networks/exoclick/raw-response',
  rollerads: '/api/networks/rollerads/raw-response',
  zeydoo: '/api/networks/zeydoo/raw-response',
  propush: '/api/networks/propush/raw-response',
};

export function useApiExplorer() {
  const [rawStates, setRawStates] = useState<Record<NetworkId, NetworkRawState>>(
    () => Object.fromEntries(NETWORKS.map(id => [id, { data: null, loading: false, loaded: false, error: null, hasApiKey: false, testResult: null, testing: false }])) as Record<NetworkId, NetworkRawState>
  );

  const fetchRaw = useCallback(async (networkId: NetworkId) => {
    const entry = rawStates[networkId];
    if (entry.loading || entry.loaded) return; // already fetching or loaded
    setRawStates(prev => ({ ...prev, [networkId]: { ...prev[networkId], loading: true } }));
    try {
      const data = await fetchWithAuth(RAW_ENDPOINTS[networkId]);
      const hasApiKey = !!(data as Record<string, unknown>)?.records || (data as Record<string, unknown>)?.hasApiKey === true;
      setRawStates(prev => ({ ...prev, [networkId]: { ...prev[networkId], data, loading: false, loaded: true, hasApiKey, error: null } }));
    } catch (err) {
      setRawStates(prev => ({ ...prev, [networkId]: { ...prev[networkId], loading: false, error: err instanceof Error ? err.message : 'Failed.' } }));
    }
  }, [rawStates]);

  const testConnection = useCallback(async (networkId: NetworkId) => {
    setRawStates(prev => ({ ...prev, [networkId]: { ...prev[networkId], testing: true, testResult: null } }));
    try {
      const result = await fetchWithAuth('/api/networks/config/test-connection', false);
      setRawStates(prev => ({ ...prev, [networkId]: { ...prev[networkId], testing: false, testResult: result } }));
    } catch (err) {
      setRawStates(prev => ({ ...prev, [networkId]: { ...prev[networkId], testing: false, testResult: { error: err instanceof Error ? err.message : 'Test failed.' } } }));
    }
  }, []);

  const clearTestResult = useCallback((networkId: NetworkId) => {
    setRawStates(prev => ({ ...prev, [networkId]: { ...prev[networkId], testResult: null } }));
  }, []);

  return { rawStates, fetchRaw, testConnection, clearTestResult };
}
