'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import { AlertCircle, CheckCircle, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { useRateLimitStatus } from '@/features/rate-limits/hooks';

interface UserQuota { endpoint: string; remaining: number; resetAt: string | null; }
interface NetworkThrottle { networkId: string; isThrottled: boolean; nextReservoirRefreshAt?: string | null; }
function findQuota(qs: unknown[], ep: string) { return (qs as UserQuota[]).find(q => q.endpoint === ep); }
function quotaEmpty(q: UserQuota | undefined) { return q != null && q.remaining === 0; }
function resetTime(q: UserQuota | undefined) { return q?.resetAt ? new Date(q.resetAt).toLocaleTimeString() : 'soon'; }

const NETWORKS = ['exoclick', 'rollerads', 'zeydoo', 'propush'] as const;
type Network = typeof NETWORKS[number];

interface CircuitNetwork {
  networkId: Network;
  isOpen: boolean;
  retryCount: number;
  openedAt?: string | null;
  autoResetAt?: string | null;
  isAutoResetPending?: boolean;
}

interface StatusData {
  summary: { networksHealthy: number; networksDegraded: number };
  networks: CircuitNetwork[];
}

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken();
  return fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

export default function CircuitBreakerStatusPanel({ onResetSuccess }: { onResetSuccess?: () => void }) {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [resetting, setResetting] = useState<Network | null>(null);
  const [resetMessages, setResetMessages] = useState<Record<string, string>>({});
  const { userQuotas, networks: rlNetworks } = useRateLimitStatus();
  const resetQuota = findQuota(userQuotas, '/api/errors/circuit-breaker/reset');
  const resetBlocked = quotaEmpty(resetQuota);
  const throttledMap = Object.fromEntries((rlNetworks as NetworkThrottle[]).map(n => [n.networkId, n]));

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await authFetch('/api/errors/circuit-breaker/status');
      if (!res.ok) { setError(true); return; }
      setData(await res.json());
    } catch { setError(true); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleReset = async (networkId: Network) => {
    setResetting(networkId);
    setResetMessages(prev => ({ ...prev, [networkId]: '' }));
    try {
      const res = await authFetch('/api/errors/circuit-breaker/reset', {
        method: 'POST',
        body: JSON.stringify({ networkId }),
      });
      if (res.status === 429) {
        setResetMessages(prev => ({ ...prev, [networkId]: 'Too many resets — try again later.' }));
        return;
      }
      if (res.status === 400) {
        const body = await res.json().catch(() => ({}));
        setResetMessages(prev => ({ ...prev, [networkId]: body.error ?? 'Circuit breaker is not open.' }));
        return;
      }
      if (!res.ok) {
        setResetMessages(prev => ({ ...prev, [networkId]: 'Reset failed.' }));
        return;
      }
      await fetchStatus();
      onResetSuccess?.();
    } finally { setResetting(null); }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded-lg" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-500">
        <AlertCircle className="w-4 h-4" />
        Failed to load circuit breaker status.
        <button onClick={fetchStatus} className="underline text-xs">Retry</button>
      </div>
    );
  }

  const networks = data?.networks ?? [];
  const summary = data?.summary;

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span className="text-gray-700 dark:text-gray-300">{summary?.networksHealthy ?? 0} healthy</span>
        </div>
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span className="text-gray-700 dark:text-gray-300">{summary?.networksDegraded ?? 0} degraded</span>
        </div>
        <button onClick={fetchStatus} className="ml-auto text-gray-400 hover:text-gray-600">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Network cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(networks.length ? networks : NETWORKS.map(id => ({ networkId: id, isOpen: false, retryCount: 0, openedAt: null, autoResetAt: null, isAutoResetPending: false } as CircuitNetwork))).map(net => (
          <div
            key={net.networkId}
            className={`rounded-xl border p-4 space-y-2 ${
              net.isOpen
                ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${net.isOpen ? 'bg-red-500' : 'bg-green-500'}`} />
                <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                  {net.networkId}
                </span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                net.isOpen
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                  : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
              }`}>
                {net.isOpen ? 'Open' : 'Closed'}
              </span>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">Retries: {net.retryCount}</p>

            {net.isOpen && (
              <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                {net.openedAt && <p>Opened: {new Date(net.openedAt).toLocaleString()}</p>}
                {net.autoResetAt && <p>Auto-reset: {new Date(net.autoResetAt).toLocaleString()}</p>}
                {net.isAutoResetPending && (
                  <span className="inline-block px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded text-xs">
                    Auto-reset pending
                  </span>
                )}
              </div>
            )}

            {/* Throttled indicator */}
            {throttledMap[net.networkId]?.isThrottled && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-3 h-3" />
                <span>Throttled</span>
                {throttledMap[net.networkId]?.nextReservoirRefreshAt && (
                  <span>— resets {new Date(throttledMap[net.networkId].nextReservoirRefreshAt!).toLocaleTimeString()}</span>
                )}
              </div>
            )}

            {net.isOpen && (
              <button
                onClick={() => handleReset(net.networkId as Network)}
                disabled={resetting === net.networkId || resetBlocked}
                title={resetBlocked ? `Quota reached — resets at ${resetTime(resetQuota)}` : undefined}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
              >
                {resetting === net.networkId && <Loader2 className="w-3 h-3 animate-spin" />}
                {resetBlocked ? 'Quota reached' : 'Reset Circuit'}
              </button>
            )}
            {net.isOpen && resetBlocked && resetQuota?.resetAt && (
              <p className="text-xs text-amber-600 dark:text-amber-400">Quota reached — resets at {resetTime(resetQuota)}</p>
            )}

            {resetMessages[net.networkId] && (
              <p className="text-xs text-amber-600 dark:text-amber-400">{resetMessages[net.networkId]}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
