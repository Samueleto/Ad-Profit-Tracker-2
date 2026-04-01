'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAuth } from 'firebase/auth';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface NetworkRetryState {
  networkId: string;
  retryCount: number;
  nextRetryAt?: string | null;
  timeUntilNextRetrySeconds?: number | null;
  lastErrorCode?: string | null;
  lastSyncStatus?: string | null;
  isRetryable?: boolean;
  circuitBreakerOpen?: boolean;
}

async function authFetch(path: string): Promise<Response> {
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken();
  return fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return 'Now';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export default function RetryStatePanel({ refreshTrigger = 0 }: { refreshTrigger?: number }) {
  const [states, setStates] = useState<NetworkRetryState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Local countdown ticks — keyed by networkId, decremented each second
  const [countdowns, setCountdowns] = useState<Record<string, number>>({});
  const prevTriggerRef = useRef(refreshTrigger);

  const fetchState = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await authFetch('/api/errors/retry-state');
      if (!res.ok) { setError(true); return; }
      const data = await res.json();
      const nets: NetworkRetryState[] = data.networks ?? data.states ?? [];
      setStates(nets);
      // Seed local countdowns from fresh API data
      const initial: Record<string, number> = {};
      nets.forEach(s => {
        if (s.timeUntilNextRetrySeconds != null) initial[s.networkId] = s.timeUntilNextRetrySeconds;
      });
      setCountdowns(initial);
    } catch { setError(true); }
    finally { setLoading(false); }
  }, []);

  // Initial load
  useEffect(() => { fetchState(); }, [fetchState]);

  // Refresh when parent increments refreshTrigger
  useEffect(() => {
    if (refreshTrigger !== prevTriggerRef.current) {
      prevTriggerRef.current = refreshTrigger;
      fetchState();
    }
  }, [refreshTrigger, fetchState]);

  // Tick countdowns down every second without re-fetching
  useEffect(() => {
    const id = setInterval(() => {
      setCountdowns(prev => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach(id => {
          if (next[id] > 0) { next[id] = next[id] - 1; changed = true; }
        });
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-500">
        <AlertCircle className="w-4 h-4" /> Failed to load retry state.
        <button onClick={fetchState} className="underline text-xs">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={fetchState} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {states.map(s => (
          <div key={s.networkId} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-2">
            <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">{s.networkId}</p>

            {s.circuitBreakerOpen ? (
              <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                Circuit breaker open — syncs paused until auto-reset.
              </div>
            ) : (
              <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                <p>Retry count: <strong className="text-gray-900 dark:text-white">{s.retryCount}</strong></p>
                {(countdowns[s.networkId] != null || s.timeUntilNextRetrySeconds != null) && (
                  <p>Next retry: <strong className="text-gray-900 dark:text-white">{formatCountdown(countdowns[s.networkId] ?? s.timeUntilNextRetrySeconds ?? 0)}</strong></p>
                )}
                {s.lastErrorCode && <p>Last error: <code className="font-mono text-red-500 dark:text-red-400">{s.lastErrorCode}</code></p>}
                {s.lastSyncStatus && (
                  <p>Sync status: <span className={`font-medium ${s.lastSyncStatus === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>{s.lastSyncStatus}</span></p>
                )}
                <p>Retryable: <strong className="text-gray-900 dark:text-white">{s.isRetryable ? 'Yes' : 'No'}</strong></p>
              </div>
            )}
          </div>
        ))}

        {states.length === 0 && (
          <div className="col-span-2 text-center text-sm text-gray-500 dark:text-gray-400 py-8">
            No retry state data available.
          </div>
        )}
      </div>
    </div>
  );
}
