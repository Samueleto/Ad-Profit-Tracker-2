'use client';

import { useState } from 'react';
import { Loader2, AlertCircle, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import { Toast } from '@/components/ui/Toast';
import { useRateLimitStatus, useRateLimitReset } from '../hooks';

const NETWORKS = ['exoclick', 'rollerads', 'zeydoo', 'propush'] as const;
type NetworkId = typeof NETWORKS[number];
const SCOPES = ['outbound', 'user-quota', 'both'] as const;
type ResetScope = typeof SCOPES[number];

interface NetworkStatus {
  networkId: string;
  isThrottled: boolean;
  reservoir?: number;
  circuitBreakerOpen?: boolean;
  nextReservoirRefreshAt?: string | null;
}

interface UserQuota {
  endpoint: string;
  remaining: number;
  limit: number;
  resetAt: string | null;
}

export default function RateLimitAdminTab() {
  const [networkId, setNetworkId] = useState<NetworkId>('exoclick');
  const [scope, setScope] = useState<ResetScope>('outbound');
  const [successToast, setSuccessToast] = useState(false);
  const [errorToast, setErrorToast] = useState(false);

  const { networks, userQuotas, loading, error, refetch, polledAt } = useRateLimitStatus();

  const { reset, loading: resetting, error: resetError } = useRateLimitReset(() => {
    setSuccessToast(true);
    refetch();
  });

  const handleReset = async () => {
    setErrorToast(false);
    setSuccessToast(false);
    try {
      await reset(networkId, scope);
    } catch {
      setErrorToast(true);
    }
  };

  const netStatuses = networks as NetworkStatus[];
  const quotas = userQuotas as UserQuota[];

  return (
    <div className="space-y-6">
      {successToast && (
        <Toast message="Rate limit reset successfully." variant="success" onClose={() => setSuccessToast(false)} />
      )}
      {errorToast && (
        <Toast message={resetError ?? 'Reset failed.'} variant="error" onClose={() => setErrorToast(false)} />
      )}

      {/* Current status */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Rate Limit Status</h3>
          <button onClick={refetch} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading && (
          <div className="animate-pulse space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg" />
            ))}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-500">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Network throttle grid */}
            {netStatuses.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Networks</p>
                <div className="grid grid-cols-2 gap-2">
                  {netStatuses.map(net => (
                    <div key={net.networkId}
                      className={`rounded-lg border p-3 space-y-1 ${
                        net.isThrottled
                          ? 'border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20'
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {net.isThrottled
                          ? <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                          : <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                        <span className="text-xs font-medium text-gray-900 dark:text-white capitalize">{net.networkId}</span>
                        <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full ${
                          net.isThrottled
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                            : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                        }`}>
                          {net.isThrottled ? 'Throttled' : 'OK'}
                        </span>
                      </div>
                      {net.reservoir != null && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">Reservoir: {net.reservoir}</p>
                      )}
                      {net.isThrottled && net.nextReservoirRefreshAt && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          Resets: {new Date(net.nextReservoirRefreshAt).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* User quotas */}
            {quotas.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">User Quotas</p>
                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                        {['Endpoint', 'Remaining', 'Limit', 'Resets At'].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {quotas.map(q => (
                        <tr key={q.endpoint} className={q.remaining === 0 ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                          <td className="px-3 py-2 text-gray-700 dark:text-gray-300 font-mono">{q.endpoint}</td>
                          <td className={`px-3 py-2 font-medium ${q.remaining === 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
                            {q.remaining}
                          </td>
                          <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{q.limit}</td>
                          <td className="px-3 py-2 text-gray-500 dark:text-gray-400">
                            {q.resetAt ? new Date(q.resetAt).toLocaleTimeString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {polledAt && (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Last updated: {new Date(polledAt).toLocaleTimeString()}
              </p>
            )}
          </>
        )}
      </div>

      {/* Reset form */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Manual Reset</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Manually reset rate limits for a network. Use with caution — this affects outbound API throttling and user quotas.
        </p>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Network</label>
            <select
              value={networkId}
              onChange={e => setNetworkId(e.target.value as NetworkId)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
            >
              {NETWORKS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Scope</label>
            <select
              value={scope}
              onChange={e => setScope(e.target.value as ResetScope)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
            >
              {SCOPES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <button
            onClick={handleReset}
            disabled={resetting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            {resetting && <Loader2 className="w-4 h-4 animate-spin" />}
            Reset Rate Limits
          </button>
        </div>
        {resetError && !errorToast && (
          <p className="text-xs text-red-600 dark:text-red-400">{resetError}</p>
        )}
      </div>
    </div>
  );
}
