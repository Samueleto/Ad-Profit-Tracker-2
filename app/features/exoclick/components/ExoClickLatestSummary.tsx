'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useExoClickLatest } from '../hooks/useExoClickStats';

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

export default function ExoClickLatestSummary() {
  const { data, isLoading, error, refetch } = useExoClickLatest();

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
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
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">No ExoClick data yet.</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">Run your first sync to see stats here.</p>
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

  const latest = data?.latest ?? data;
  const syncStatus = data?.lastSyncStatus ?? latest?.lastSyncStatus;
  const syncedAt = data?.lastSyncedAt ?? latest?.lastSyncedAt;

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
        <StatCell label="Cost" value={latest?.cost != null ? `$${Number(latest.cost).toFixed(4)}` : '—'} />
        <StatCell label="Impressions" value={latest?.impressions != null ? Number(latest.impressions).toLocaleString() : '—'} />
        <StatCell label="Clicks" value={latest?.clicks != null ? Number(latest.clicks).toLocaleString() : '—'} />
        <StatCell label="CTR" value={latest?.ctr != null ? `${Number(latest.ctr).toFixed(2)}%` : '—'} />
        <StatCell label="CPM" value={latest?.cpm != null ? `$${Number(latest.cpm).toFixed(4)}` : '—'} />
        <StatCell label="Countries" value={latest?.countryCount != null ? String(latest.countryCount) : '—'} />
      </div>

      {syncedAt && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Last synced: {new Date(syncedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
