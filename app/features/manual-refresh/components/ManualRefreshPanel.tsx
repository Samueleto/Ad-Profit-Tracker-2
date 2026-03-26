'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import { SUPPORTED_NETWORKS, type NetworkId } from '@/lib/constants';
import NetworkSyncRow from './NetworkSyncRow';
import SyncHistoryDrawer from './SyncHistoryDrawer';
import { type SyncStatus } from './SyncStatusBadge';

interface NetworkState {
  networkId: NetworkId;
  lastSyncedAt: Date | null;
  lastSyncStatus: SyncStatus;
  isRefreshing: boolean;
  rateLimitCountdown: number | null;
}

const INITIAL_STATE: NetworkState[] = SUPPORTED_NETWORKS.map(n => ({
  networkId: n,
  lastSyncedAt: null,
  lastSyncStatus: 'never',
  isRefreshing: false,
  rateLimitCountdown: null,
}));

async function apiCall(path: string, opts: RequestInit = {}, forceRefresh = false): Promise<Response> {
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken(forceRefresh);
  return fetch(path, {
    ...opts,
    headers: {
      ...(opts.headers as Record<string, string> ?? {}),
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

export default function ManualRefreshPanel() {
  const router = useRouter();
  const [networks, setNetworks] = useState<NetworkState[]>(INITIAL_STATE);
  const [loading, setLoading] = useState(true);
  const [syncingAll, setSyncingAll] = useState(false);
  const [allRateLimit, setAllRateLimit] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [noNetworks, setNoNetworks] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchStatus = useCallback(async (retry = false) => {
    try {
      let res = await apiCall('/api/sync/status', {}, retry);
      if (res.status === 401 && !retry) {
        res = await apiCall('/api/sync/status', {}, true);
      }
      if (res.status === 401) { router.push('/'); return; }
      if (!res.ok) return;
      const data = await res.json();
      const statuses: Array<{ networkId: NetworkId; lastSyncedAt: string | null; lastSyncStatus: SyncStatus }> = data.networks ?? [];
      if (statuses.length === 0) { setNoNetworks(true); return; }
      setNoNetworks(false);
      setNetworks(prev => prev.map(n => {
        const found = statuses.find(s => s.networkId === n.networkId);
        if (!found) return n;
        return {
          ...n,
          lastSyncedAt: found.lastSyncedAt ? new Date(found.lastSyncedAt) : null,
          lastSyncStatus: found.lastSyncStatus,
          isRefreshing: found.lastSyncStatus === 'in_progress',
        };
      }));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);

    pollRef.current = setInterval(() => {
      fetchStatus();
      // Check if all triggered networks are terminal
      setNetworks(prev => {
        const allDone = prev.every(n => n.lastSyncStatus === 'success' || n.lastSyncStatus === 'failed' || n.lastSyncStatus === 'never');
        if (allDone && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        return prev;
      });
    }, 3000);

    // Stop polling after 60s regardless
    pollTimeoutRef.current = setTimeout(() => {
      if (pollRef.current) clearInterval(pollRef.current);
    }, 60000);
  }, [fetchStatus]);

  const handleRefreshAll = async () => {
    setSyncingAll(true);
    try {
      let res = await apiCall('/api/sync/manual', { method: 'POST', body: JSON.stringify({}) });
      if (res.status === 401) {
        res = await apiCall('/api/sync/manual', { method: 'POST', body: JSON.stringify({}) }, true);
      }
      if (res.status === 401) { router.push('/'); return; }
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') ?? '60', 10);
        setAllRateLimit(retryAfter);
        const timer = setInterval(() => {
          setAllRateLimit(prev => {
            if (prev === null || prev <= 1) { clearInterval(timer); return null; }
            return prev - 1;
          });
        }, 1000);
        return;
      }
      setNetworks(prev => prev.map(n => ({ ...n, lastSyncStatus: 'in_progress', isRefreshing: true })));
      startPolling();
    } finally {
      setSyncingAll(false);
    }
  };

  const handleNetworkRefresh = async (networkId: NetworkId) => {
    setNetworks(prev => prev.map(n => n.networkId === networkId ? { ...n, isRefreshing: true, lastSyncStatus: 'in_progress' } : n));
    try {
      let res = await apiCall('/api/sync/manual', { method: 'POST', body: JSON.stringify({ networkId }) });
      if (res.status === 401) {
        res = await apiCall('/api/sync/manual', { method: 'POST', body: JSON.stringify({ networkId }) }, true);
      }
      if (res.status === 401) { router.push('/'); return; }
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') ?? '60', 10);
        setNetworks(prev => prev.map(n => n.networkId === networkId ? { ...n, isRefreshing: false, rateLimitCountdown: retryAfter } : n));
        const timer = setInterval(() => {
          setNetworks(prev => {
            const net = prev.find(n => n.networkId === networkId);
            if (!net || net.rateLimitCountdown === null || net.rateLimitCountdown <= 1) {
              clearInterval(timer);
              return prev.map(n => n.networkId === networkId ? { ...n, rateLimitCountdown: null } : n);
            }
            return prev.map(n => n.networkId === networkId ? { ...n, rateLimitCountdown: (n.rateLimitCountdown ?? 1) - 1 } : n);
          });
        }, 1000);
        return;
      }
      startPolling();
    } catch {
      setNetworks(prev => prev.map(n => n.networkId === networkId ? { ...n, isRefreshing: false, lastSyncStatus: 'failed' } : n));
    }
  };

  if (noNetworks) {
    return (
      <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
        No networks configured.{' '}
        <a href="/settings" className="text-blue-600 underline">Go to Settings</a> to add API keys.
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Data Sync</h3>
        <button
          onClick={() => setDrawerOpen(true)}
          className="text-xs text-blue-600 hover:underline"
        >
          View Sync History
        </button>
      </div>

      {/* Refresh All button */}
      <button
        onClick={handleRefreshAll}
        disabled={syncingAll || allRateLimit !== null}
        className="w-full flex items-center justify-center gap-2 py-2 px-4 mb-4 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
      >
        {syncingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        {syncingAll
          ? 'Syncing…'
          : allRateLimit !== null
          ? `Available in ${allRateLimit}s`
          : 'Refresh All Data Now'}
      </button>

      {/* Network rows */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {loading
          ? SUPPORTED_NETWORKS.map(n => (
            <div key={n} className="flex items-center gap-3 py-2 animate-pulse">
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-3 w-16 bg-gray-100 dark:bg-gray-800 rounded" />
              </div>
              <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
              <div className="h-7 w-7 bg-gray-100 dark:bg-gray-800 rounded-lg" />
            </div>
          ))
          : networks.map(n => (
            <NetworkSyncRow
              key={n.networkId}
              networkId={n.networkId}
              lastSyncedAt={n.lastSyncedAt}
              lastSyncStatus={n.lastSyncStatus}
              isRefreshing={n.isRefreshing}
              rateLimitCountdown={n.rateLimitCountdown}
              onRefresh={() => handleNetworkRefresh(n.networkId)}
            />
          ))}
      </div>

      <SyncHistoryDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
