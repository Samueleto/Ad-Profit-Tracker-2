'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAuth } from 'firebase/auth';
import type { NetworkConfig, NetworkConfigUpdate } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TestStatus = 'idle' | 'testing' | 'success' | 'error';

export interface TestResult {
  status: TestStatus;
  latencyMs?: number;
  sampleRecordCount?: number;
  errorMessage?: string;
}

export interface SyncAllResult {
  triggered: number;
  skipped: number;
  failed: number;
}

export interface UseNetworkConfigsResult {
  networks: NetworkConfig[];
  loading: boolean;
  error: string | null;
  accessDenied: boolean;
  authExpired: boolean;
  testResults: Record<string, TestResult>;
  syncAllLoading: boolean;
  syncAllResult: SyncAllResult | null;
  reload: () => void;
  updateNetworkConfig: (networkId: string, update: NetworkConfigUpdate) => Promise<void>;
  reorderNetworks: (ordered: NetworkConfig[]) => Promise<void>;
  testConnection: (networkId: string) => Promise<void>;
  syncAll: () => Promise<{ rateLimited?: boolean; serverError?: boolean }>;
  resetNetworkConfig: (networkId: string) => Promise<void>;
}

// ─── Defaults for 404 (no configs created yet) ───────────────────────────────

const SUPPORTED_NETWORKS = ['exoclick', 'rollerads', 'zeydoo', 'propush'];

function buildDefaultConfig(networkId: string, idx: number): NetworkConfig {
  return {
    userId: '',
    networkId,
    isActive: false,
    syncSchedule: 'daily',
    dataRole: 'revenue',
    endpointOverride: null,
    timeoutSeconds: 30,
    retryAttempts: 3,
    lastSyncedAt: null,
    lastSyncStatus: null,
    lastSyncError: null,
    displayOrder: idx,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createdAt: null as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updatedAt: null as any,
  };
}

// ─── Auth fetch with 401 retry ────────────────────────────────────────────────

async function authFetch(
  path: string,
  init: RequestInit,
  onAuthExpired: () => void
): Promise<Response> {
  const auth = getAuth();
  const getToken = async (forceRefresh = false): Promise<Record<string, string>> => {
    const token = await auth.currentUser?.getIdToken(forceRefresh);
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  };

  let headers = await getToken();
  let res = await fetch(path, { ...init, headers });
  if (res.status === 401) {
    headers = await getToken(true);
    res = await fetch(path, { ...init, headers });
    if (res.status === 401) {
      onAuthExpired();
    }
  }
  return res;
}

function sortByDisplayOrder(networks: NetworkConfig[]): NetworkConfig[] {
  return [...networks].sort((a, b) => a.displayOrder - b.displayOrder);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNetworkConfigs(): UseNetworkConfigsResult {
  const [networks, setNetworks] = useState<NetworkConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [authExpired, setAuthExpired] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [syncAllLoading, setSyncAllLoading] = useState(false);
  const [syncAllResult, setSyncAllResult] = useState<SyncAllResult | null>(null);
  const mountedRef = useRef(true);
  const [loadTrigger, setLoadTrigger] = useState(0);

  const onAuthExpired = useCallback(() => {
    if (mountedRef.current) setAuthExpired(true);
  }, []);

  const reload = useCallback(() => {
    setLoadTrigger(t => t + 1);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    setError(null);
    setAccessDenied(false);

    (async () => {
      try {
        const res = await authFetch('/api/networks/config/list', {}, onAuthExpired);
        if (!mountedRef.current) return;
        if (res.status === 403) { setAccessDenied(true); return; }
        if (res.status === 404) {
          // No configs yet — silently initialize defaults
          setNetworks(SUPPORTED_NETWORKS.map((id, idx) => buildDefaultConfig(id, idx)));
          return;
        }
        if (!res.ok) {
          setError('Failed to load network settings. Please try again.');
          return;
        }
        const data = await res.json();
        const list: NetworkConfig[] = data.configs ?? data.networks ?? [];
        // No configs saved yet — initialize with defaults so the UI is never blank
        if (list.length === 0) {
          setNetworks(SUPPORTED_NETWORKS.map((id, idx) => buildDefaultConfig(id, idx)));
        } else {
          setNetworks(sortByDisplayOrder(list));
        }
      } catch {
        if (mountedRef.current) {
          setError('Unable to load network settings — check your connection.');
        }
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
    return () => { mountedRef.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onAuthExpired, loadTrigger]);

  const updateNetworkConfig = useCallback(async (networkId: string, update: NetworkConfigUpdate) => {
    // Optimistic update
    setNetworks(prev => {
      const updated = prev.map(n => n.networkId === networkId ? { ...n, ...update } : n);
      return sortByDisplayOrder(updated);
    });
    const previous = networks;
    try {
      const res = await authFetch('/api/networks/config/update', {
        method: 'PATCH',
        body: JSON.stringify({ networkId, ...update }),
      }, onAuthExpired);
      if (!res.ok) {
        setNetworks(sortByDisplayOrder(previous));
        const data = await res.json().catch(() => ({}));
        if (res.status === 400) {
          const err = new Error(data?.message ?? 'Invalid configuration value.');
          (err as Error & { fieldError?: boolean }).fieldError = true;
          throw err;
        }
        throw new Error(data?.message ?? `Failed to save settings.`);
      }
    } catch (err) {
      setNetworks(sortByDisplayOrder(previous));
      throw err;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [networks, onAuthExpired]);

  const reorderNetworks = useCallback(async (ordered: NetworkConfig[]) => {
    const previous = networks;
    const reindexed = ordered.map((n, i) => ({ ...n, displayOrder: i }));
    setNetworks(reindexed);
    try {
      const res = await authFetch('/api/networks/config/reorder', {
        method: 'PATCH',
        body: JSON.stringify({ order: reindexed.map(n => ({ networkId: n.networkId, displayOrder: n.displayOrder })) }),
      }, onAuthExpired);
      if (!res.ok) {
        setNetworks(previous);
        throw new Error('reorder_failed');
      }
    } catch (err) {
      setNetworks(previous);
      throw err;
    }
  }, [networks, onAuthExpired]);

  const testConnection = useCallback(async (networkId: string) => {
    const config = networks.find(n => n.networkId === networkId);
    const timeoutMs = (config?.timeoutSeconds ?? 30) * 1000;

    setTestResults(prev => ({ ...prev, [networkId]: { status: 'testing' } }));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await authFetch('/api/networks/config/test-connection', {
        method: 'POST',
        body: JSON.stringify({ networkId }),
        signal: controller.signal,
      } as RequestInit, onAuthExpired);
      clearTimeout(timeoutId);

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        let msg: string;
        if (res.status === 404) {
          msg = 'No API key saved for this network. Add one in the API Keys settings.';
        } else if (res.status === 502) {
          msg = `Connection failed — ${data?.message ?? 'network API unreachable'}.`;
        } else {
          msg = 'Test failed due to a server error. Try again.';
        }
        setTestResults(prev => ({ ...prev, [networkId]: { status: 'error', errorMessage: msg } }));
        return;
      }
      setTestResults(prev => ({
        ...prev,
        [networkId]: {
          status: 'success',
          latencyMs: data.latencyMs,
          sampleRecordCount: data.sampleRecordCount,
        },
      }));
    } catch (err) {
      clearTimeout(timeoutId);
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      setTestResults(prev => ({
        ...prev,
        [networkId]: {
          status: 'error',
          errorMessage: isTimeout ? 'Connection timed out.' : 'Test failed due to a network error.',
        },
      }));
    }
  }, [networks, onAuthExpired]);

  const syncAll = useCallback(async (): Promise<{ rateLimited?: boolean; serverError?: boolean }> => {
    setSyncAllLoading(true);
    setSyncAllResult(null);
    try {
      const res = await authFetch('/api/networks/sync-all', { method: 'POST' }, onAuthExpired);
      if (res.status === 429) return { rateLimited: true };
      if (!res.ok) return { serverError: true };
      const data = await res.json().catch(() => ({}));
      const result = { triggered: data.triggered ?? 0, skipped: data.skipped ?? 0, failed: data.failed ?? 0 };
      setSyncAllResult(result);
      return {};
    } catch {
      return { serverError: true };
    } finally {
      setSyncAllLoading(false);
    }
  }, [onAuthExpired]);

  const resetNetworkConfig = useCallback(async (networkId: string) => {
    const res = await authFetch(`/api/networks/config/reset`, {
      method: 'DELETE',
      body: JSON.stringify({ networkId }),
    }, onAuthExpired);
    if (res.status === 404) throw new Error('nothing_to_reset');
    if (!res.ok) throw new Error('reset_failed');
    const data = await res.json().catch(() => ({}));
    const defaultConfig: NetworkConfig = data.config ?? data;
    setNetworks(prev => sortByDisplayOrder(prev.map(n => n.networkId === networkId ? defaultConfig : n)));
  }, [onAuthExpired]);

  return {
    networks,
    loading,
    error,
    accessDenied,
    authExpired,
    testResults,
    syncAllLoading,
    syncAllResult,
    reload,
    updateNetworkConfig,
    reorderNetworks,
    testConnection,
    syncAll,
    resetNetworkConfig,
  };
}
