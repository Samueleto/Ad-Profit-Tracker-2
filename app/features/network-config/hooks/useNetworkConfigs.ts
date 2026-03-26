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
  authExpired: boolean;
  testResults: Record<string, TestResult>;
  syncAllLoading: boolean;
  syncAllResult: SyncAllResult | null;
  updateNetworkConfig: (networkId: string, update: NetworkConfigUpdate) => Promise<void>;
  reorderNetworks: (ordered: NetworkConfig[]) => Promise<void>;
  testConnection: (networkId: string) => Promise<void>;
  syncAll: () => Promise<void>;
  resetNetworkConfig: (networkId: string) => Promise<void>;
}

// ─── Auth fetch with 401 retry ────────────────────────────────────────────────

async function authFetch(
  path: string,
  init: RequestInit,
  onAuthExpired: () => void
): Promise<Response> {
  const auth = getAuth();
  const getToken = async (forceRefresh = false) => {
    const token = await auth.currentUser?.getIdToken(forceRefresh);
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
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
  const [authExpired, setAuthExpired] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [syncAllLoading, setSyncAllLoading] = useState(false);
  const [syncAllResult, setSyncAllResult] = useState<SyncAllResult | null>(null);
  const mountedRef = useRef(true);

  const onAuthExpired = useCallback(() => {
    if (mountedRef.current) setAuthExpired(true);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        const res = await authFetch('/api/networks/config/list', {}, onAuthExpired);
        if (!mountedRef.current) return;
        if (!res.ok) { setError('Failed to load network configs.'); return; }
        const data = await res.json();
        const list: NetworkConfig[] = data.networks ?? data ?? [];
        setNetworks(sortByDisplayOrder(list));
      } catch (err) {
        if (mountedRef.current) setError(err instanceof Error ? err.message : 'Failed to load network configs.');
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
    return () => { mountedRef.current = false; };
  }, [onAuthExpired]);

  const updateNetworkConfig = useCallback(async (networkId: string, update: NetworkConfigUpdate) => {
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
        throw new Error(data?.message ?? 'Failed to update network config.');
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
        throw new Error('Failed to reorder networks.');
      }
    } catch (err) {
      setNetworks(previous);
      throw err;
    }
  }, [networks, onAuthExpired]);

  const testConnection = useCallback(async (networkId: string) => {
    setTestResults(prev => ({ ...prev, [networkId]: { status: 'testing' } }));
    try {
      const res = await authFetch('/api/networks/config/test-connection', {
        method: 'POST',
        body: JSON.stringify({ networkId }),
      }, onAuthExpired);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTestResults(prev => ({ ...prev, [networkId]: { status: 'error', errorMessage: data?.message ?? 'Test failed.' } }));
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
      setTestResults(prev => ({ ...prev, [networkId]: { status: 'error', errorMessage: err instanceof Error ? err.message : 'Test failed.' } }));
    }
  }, [onAuthExpired]);

  const syncAll = useCallback(async () => {
    setSyncAllLoading(true);
    setSyncAllResult(null);
    try {
      const res = await authFetch('/api/networks/sync-all', { method: 'POST' }, onAuthExpired);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSyncAllResult({ triggered: data.triggered ?? 0, skipped: data.skipped ?? 0, failed: data.failed ?? 0 });
      }
    } finally {
      setSyncAllLoading(false);
    }
  }, [onAuthExpired]);

  const resetNetworkConfig = useCallback(async (networkId: string) => {
    const res = await authFetch(`/api/networks/config/reset`, {
      method: 'DELETE',
      body: JSON.stringify({ networkId }),
    }, onAuthExpired);
    if (!res.ok) throw new Error('Failed to reset network config.');
    const data = await res.json().catch(() => ({}));
    const defaultConfig: NetworkConfig = data.config ?? data;
    setNetworks(prev => sortByDisplayOrder(prev.map(n => n.networkId === networkId ? defaultConfig : n)));
  }, [onAuthExpired]);

  return {
    networks,
    loading,
    error,
    authExpired,
    testResults,
    syncAllLoading,
    syncAllResult,
    updateNetworkConfig,
    reorderNetworks,
    testConnection,
    syncAll,
    resetNetworkConfig,
  };
}
