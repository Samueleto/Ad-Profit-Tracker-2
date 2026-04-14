'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { usePropushLatest } from '../hooks/usePropushStats';

export default function PropushLatestCard({ onSync }: { onSync?: () => void }) {
  const { data, isLoading, error, refetch } = usePropushLatest();

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-2/3" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const status = (error as Error & { status?: number })?.status;

  if (status === 404 || (!data && !error)) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">No Propush data yet.</p>
        <button
          onClick={onSync}
          className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Run First Sync
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-500">
        <AlertTriangle className="w-4 h-4" />
        Failed to load latest stats.
        <button onClick={() => refetch()} className="underline text-xs">Retry</button>
      </div>
    );
  }

  const d = data as Record<string, unknown> | null;
  const latest = (d?.latest ?? d) as Record<string, unknown> | null;
  const syncStatus = (d?.lastSyncStatus ?? latest?.lastSyncStatus) as string | undefined;
  const syncedAt = (d?.lastSyncedAt ?? latest?.lastSyncedAt) as string | undefined;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Latest Day</span>
          {syncStatus === 'failed' && (
            <span className="flex items-center gap-1 px-2 py-0.5 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full">
              <AlertTriangle className="w-3 h-3" /> Sync Failed
            </span>
          )}
        </div>
        <button onClick={() => refetch()} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: 'Revenue', value: latest?.revenue != null ? `$${Number(latest.revenue).toFixed(4)}` : '—' },
          { label: 'Impressions', value: latest?.impressions != null ? Number(latest.impressions).toLocaleString() : '—' },
          { label: 'Clicks', value: latest?.clicks != null ? Number(latest.clicks).toLocaleString() : '—' },
        ].map(s => (
          <div key={s.label}>
            <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {syncedAt && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Last synced: {new Date(syncedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
