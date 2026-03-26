'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import type { NetworkConfig, NetworkConfigUpdate } from '../types';
import NetworkCard from './NetworkCard';

const NETWORK_LABELS: Record<string, string> = {
  exoclick: 'ExoClick',
  rollerads: 'RollerAds',
  zeydoo: 'Zeydoo',
  propush: 'Propush',
};

const DEFAULT_CONFIGS: NetworkConfig[] = [
  { userId: '', networkId: 'exoclick', isActive: true, syncSchedule: 'daily', dataRole: 'cost', endpointOverride: null, timeoutSeconds: 30, retryAttempts: 3, lastSyncedAt: null, lastSyncStatus: null, lastSyncError: null, displayOrder: 0, createdAt: null as unknown as never, updatedAt: null as unknown as never },
  { userId: '', networkId: 'rollerads', isActive: true, syncSchedule: 'daily', dataRole: 'revenue', endpointOverride: null, timeoutSeconds: 30, retryAttempts: 3, lastSyncedAt: null, lastSyncStatus: null, lastSyncError: null, displayOrder: 1, createdAt: null as unknown as never, updatedAt: null as unknown as never },
  { userId: '', networkId: 'zeydoo', isActive: true, syncSchedule: 'daily', dataRole: 'revenue', endpointOverride: null, timeoutSeconds: 30, retryAttempts: 3, lastSyncedAt: null, lastSyncStatus: null, lastSyncError: null, displayOrder: 2, createdAt: null as unknown as never, updatedAt: null as unknown as never },
  { userId: '', networkId: 'propush', isActive: true, syncSchedule: 'daily', dataRole: 'revenue', endpointOverride: null, timeoutSeconds: 30, retryAttempts: 3, lastSyncedAt: null, lastSyncStatus: null, lastSyncError: null, displayOrder: 3, createdAt: null as unknown as never, updatedAt: null as unknown as never },
];

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const auth = getAuth();
  let token = await auth.currentUser?.getIdToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  let res = await fetch(path, { ...init, headers });
  if (res.status === 401) {
    token = await auth.currentUser?.getIdToken(true);
    res = await fetch(path, {
      ...init,
      headers: { ...headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  }
  return res;
}

type FetchState = 'loading' | 'success' | 'forbidden' | 'error';

export default function NetworkConfigTab() {
  const router = useRouter();
  const [configs, setConfigs] = useState<NetworkConfig[]>([]);
  const [fetchState, setFetchState] = useState<FetchState>('loading');
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  const fetchConfigs = useCallback(async () => {
    setFetchState('loading');
    try {
      const res = await authFetch('/api/networks/config/list');
      if (res.status === 401) { router.push('/'); return; }
      if (res.status === 403) { setFetchState('forbidden'); return; }
      if (res.status === 404) {
        setConfigs([...DEFAULT_CONFIGS]);
        setFetchState('success');
        return;
      }
      if (!res.ok) { setFetchState('error'); return; }
      const data = await res.json();
      const list: NetworkConfig[] = data.configs ?? DEFAULT_CONFIGS;
      list.sort((a, b) => a.displayOrder - b.displayOrder);
      setConfigs(list);
      setFetchState('success');
    } catch {
      setFetchState('error');
    }
  }, [router]);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  const handleUpdate = useCallback(async (networkId: string, update: NetworkConfigUpdate) => {
    const res = await authFetch('/api/networks/config/update', {
      method: 'PATCH',
      body: JSON.stringify({ networkId, ...update }),
    });
    if (!res.ok) throw new Error(`Failed to update ${networkId}`);
  }, []);

  const handleSyncAll = async () => {
    setSyncingAll(true);
    setSyncToast(null);
    try {
      const res = await authFetch('/api/networks/sync-all', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        const triggered = data.triggered?.join(', ') ?? '';
        const skipped = data.skipped?.join(', ') ?? '';
        const failed = data.failed?.join(', ') ?? '';
        setSyncToast(`Synced: ${triggered || 'none'} | Skipped: ${skipped || 'none'} | Failed: ${failed || 'none'}`);
        setTimeout(() => setSyncToast(null), 5000);
      }
    } finally {
      setSyncingAll(false);
    }
  };

  const getConnectionStatus = (config: NetworkConfig): 'connected' | 'not_connected' | 'error' => {
    if (config.lastSyncStatus === 'failed') return 'error';
    if (config.lastSyncedAt) return 'connected';
    return 'not_connected';
  };

  if (fetchState === 'forbidden') {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
        <span className="text-sm text-red-700 dark:text-red-400">Access Denied</span>
      </div>
    );
  }

  if (fetchState === 'error') {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
        <span className="text-sm text-red-700 dark:text-red-400 flex-1">Failed to load network configs.</span>
        <button onClick={fetchConfigs} className="text-xs text-red-700 underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sync All button + toast */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex-1">
          {syncToast && (
            <p className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 rounded-lg">
              {syncToast}
            </p>
          )}
        </div>
        <button
          onClick={handleSyncAll}
          disabled={syncingAll}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
        >
          {syncingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Sync All Now
        </button>
      </div>

      {/* Network cards */}
      {fetchState === 'loading' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
              </div>
              <div className="h-3 w-32 bg-gray-100 dark:bg-gray-800 rounded" />
              <div className="h-8 w-full bg-gray-100 dark:bg-gray-800 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {configs.map(config => (
            <NetworkCard
              key={config.networkId}
              config={config}
              networkName={NETWORK_LABELS[config.networkId] ?? config.networkId}
              connectionStatus={getConnectionStatus(config)}
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
