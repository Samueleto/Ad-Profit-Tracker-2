'use client';

import { useState, useCallback } from 'react';
import { Loader2, RefreshCw, CheckCircle, XCircle, Clock, ChevronDown, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  useSyncStatus,
  useRetrySync,
  useSyncHistory,
  type ScheduledNetworkStatus,
  type SyncHistoryEntry,
} from '../hooks/useScheduledSync';
import { useRateLimitStatus } from '@/features/rate-limits/hooks';

interface UserQuota { endpoint: string; remaining: number; resetAt: string | null; }
interface NetworkThrottle { networkId: string; isThrottled: boolean; nextReservoirRefreshAt?: string | null; }
function findQuota(qs: unknown[], ep: string) { return (qs as UserQuota[]).find(q => q.endpoint === ep); }
function quotaEmpty(q: UserQuota | undefined) { return q != null && q.remaining === 0; }
function resetTime(q: UserQuota | undefined) { return q?.resetAt ? new Date(q.resetAt).toLocaleTimeString() : 'soon'; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(isoString: string | null): string {
  if (!isoString) return '—';
  const diff = Date.now() - new Date(isoString).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function StatusBadge({ status }: { status: ScheduledNetworkStatus['lastSyncStatus'] }) {
  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
        <CheckCircle className="w-3 h-3" /> Success
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
        <XCircle className="w-3 h-3" /> Failed
      </span>
    );
  }
  if (status === 'partial') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
        <Clock className="w-3 h-3" /> Partial
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
      Never
    </span>
  );
}

// ─── Network card ─────────────────────────────────────────────────────────────

const NETWORK_LABELS: Record<string, string> = {
  exoclick: 'ExoClick',
  rollerads: 'RollerAds',
  zeydoo: 'Zeydoo',
  propush: 'Propush',
};

interface NetworkCardProps {
  network: ScheduledNetworkStatus;
  isRetrying: boolean;
  retryError: string | undefined;
  onRetry: (id: string) => void;
  throttled?: boolean;
  nextReservoirRefreshAt?: string | null;
  retryBlocked?: boolean;
  retryResetAt?: string | null;
}

function NetworkCard({ network, isRetrying, retryError, onRetry, throttled, nextReservoirRefreshAt, retryBlocked, retryResetAt }: NetworkCardProps) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {NETWORK_LABELS[network.networkId] ?? network.networkId}
          </span>
          {throttled && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-3 h-3" /> Throttled
            </span>
          )}
        </div>
        <StatusBadge status={network.lastSyncStatus} />
      </div>
      {throttled && nextReservoirRefreshAt && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Rate limit resets: {new Date(nextReservoirRefreshAt).toLocaleTimeString()}
        </p>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        <span>Last synced</span>
        <span className="text-gray-700 dark:text-gray-300">{relativeTime(network.lastSyncedAt)}</span>
        <span>Latest data</span>
        <span className="text-gray-700 dark:text-gray-300">{network.latestDataDate ?? '—'}</span>
        <span>Next sync</span>
        <span className="text-gray-700 dark:text-gray-300">
          {network.nextScheduledSync ? relativeTime(network.nextScheduledSync) : '—'}
        </span>
      </div>

      {network.lastSyncStatus === 'failed' && (
        <div className="pt-1 space-y-1">
          <button
            onClick={() => onRetry(network.networkId)}
            disabled={isRetrying || retryBlocked}
            title={retryBlocked ? `Quota reached — resets at ${retryResetAt ? new Date(retryResetAt).toLocaleTimeString() : 'soon'}` : undefined}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-60 transition-colors"
          >
            {isRetrying ? (
              <><Loader2 className="w-3 h-3 animate-spin" /> Retrying…</>
            ) : retryBlocked ? (
              'Quota reached'
            ) : (
              <><RefreshCw className="w-3 h-3" /> Retry</>
            )}
          </button>
          {retryBlocked && retryResetAt && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Quota reached — resets at {new Date(retryResetAt).toLocaleTimeString()}
            </p>
          )}
          {retryError && (
            <p className="text-xs text-red-600 dark:text-red-400">{retryError}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── History row ──────────────────────────────────────────────────────────────

function HistoryRow({ entry }: { entry: SyncHistoryEntry }) {
  const statusColors: Record<string, string> = {
    success: 'text-green-600 dark:text-green-400',
    failed: 'text-red-600 dark:text-red-400',
    partial: 'text-amber-600 dark:text-amber-400',
  };
  return (
    <tr className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
      <td className="px-3 py-2 text-xs text-gray-700 dark:text-gray-300">
        {NETWORK_LABELS[entry.networkId] ?? entry.networkId}
      </td>
      <td className={`px-3 py-2 text-xs font-medium capitalize ${statusColors[entry.status] ?? 'text-gray-500'}`}>
        {entry.status}
      </td>
      <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
        {entry.rowsFetched != null ? entry.rowsFetched.toLocaleString() : '—'}
      </td>
      <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
        {entry.latencyMs != null ? `${entry.latencyMs}ms` : '—'}
      </td>
      <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
        {entry.triggeredBy === 'scheduler' ? 'Scheduled' : 'Manual'}
      </td>
      <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-500 whitespace-nowrap">
        {relativeTime(entry.triggeredAt)}
      </td>
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const NETWORK_OPTIONS = ['all', 'exoclick', 'rollerads', 'zeydoo', 'propush'] as const;
type NetworkOption = typeof NETWORK_OPTIONS[number];

export default function ScheduledSyncDashboard() {
  const [historyFilter, setHistoryFilter] = useState<NetworkOption>('all');
  const [historyOpen, setHistoryOpen] = useState(false);

  const { networks, isLoading, error, refresh } = useSyncStatus();
  const { userQuotas, networks: rlNetworks } = useRateLimitStatus();
  const retryQuota = findQuota(userQuotas, '/api/scheduled/retry-failed');
  const retryBlocked = quotaEmpty(retryQuota);
  const throttledMap = Object.fromEntries((rlNetworks as NetworkThrottle[]).map(n => [n.networkId, n]));

  const handleRetrySuccess = useCallback(() => {
    toast.success('Retry succeeded — data will update shortly.');
    refresh();
  }, [refresh]);

  const { retryNetwork, isRetrying, retryError } = useRetrySync(handleRetrySuccess);

  const handleRetry = useCallback(async (networkId: string) => {
    try {
      await retryNetwork(networkId);
      if (retryError[networkId]) {
        toast.error(retryError[networkId]);
      }
    } catch {
      // error is already in retryError state
    }
  }, [retryNetwork, retryError]);

  const { history, hasMore, isLoading: historyLoading, error: historyError, loadMore } = useSyncHistory(
    historyFilter === 'all' ? undefined : historyFilter,
    10,
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse bg-gray-100 dark:bg-gray-800 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-3 text-sm text-red-600 dark:text-red-400">
        <XCircle className="w-4 h-4 flex-shrink-0" /> {error}
        <button onClick={refresh} className="ml-2 underline text-xs">Retry</button>
      </div>
    );
  }

  // Ensure all four networks are represented (fill in absent ones as inactive)
  const NETWORKS = ['exoclick', 'rollerads', 'zeydoo', 'propush'];
  const networkMap = Object.fromEntries(networks.map(n => [n.networkId, n]));
  const displayNetworks = NETWORKS.map(id => networkMap[id] ?? ({
    networkId: id,
    isActive: false,
    syncSchedule: '0 3 * * *',
    lastSyncedAt: null,
    lastSyncStatus: 'never' as const,
    lastSyncError: null,
    latestDataDate: null,
    nextScheduledSync: null,
  }));

  return (
    <>

      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Scheduled Sync Status</h3>
          <button
            onClick={refresh}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Network status grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {displayNetworks.map(n => (
            <NetworkCard
              key={n.networkId}
              network={n}
              isRetrying={isRetrying.has(n.networkId)}
              retryError={retryError[n.networkId]}
              onRetry={handleRetry}
              throttled={throttledMap[n.networkId]?.isThrottled}
              nextReservoirRefreshAt={throttledMap[n.networkId]?.nextReservoirRefreshAt}
              retryBlocked={retryBlocked}
              retryResetAt={retryQuota?.resetAt}
            />
          ))}
        </div>

        {/* Sync history */}
        <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
          <button
            onClick={() => setHistoryOpen(o => !o)}
            className="flex items-center gap-1.5 w-full text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${historyOpen ? 'rotate-180' : ''}`} />
            Sync History
          </button>

          {historyOpen && (
            <div className="mt-3 space-y-3">
              {/* Filter */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 dark:text-gray-400">Network</label>
                <select
                  value={historyFilter}
                  onChange={e => setHistoryFilter(e.target.value as NetworkOption)}
                  className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                >
                  <option value="all">All networks</option>
                  {NETWORK_OPTIONS.slice(1).map(n => (
                    <option key={n} value={n}>{NETWORK_LABELS[n]}</option>
                  ))}
                </select>
              </div>

              {historyError && (
                <p className="text-xs text-red-600 dark:text-red-400">{historyError}</p>
              )}

              {historyLoading && history.length === 0 && (
                <div className="h-20 animate-pulse bg-gray-100 dark:bg-gray-800 rounded-xl" />
              )}

              {!historyLoading && history.length === 0 && !historyError && (
                <p className="text-xs text-gray-500 dark:text-gray-400 py-4 text-center">No sync history yet.</p>
              )}

              {history.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                        {['Network', 'Status', 'Rows', 'Latency', 'Trigger', 'When'].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {history.map(entry => (
                        <HistoryRow key={entry.id} entry={entry} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {hasMore && (
                <button
                  onClick={loadMore}
                  disabled={historyLoading}
                  className="w-full py-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                >
                  {historyLoading ? 'Loading…' : 'Load More'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
