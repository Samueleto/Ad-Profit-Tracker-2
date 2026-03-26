'use client';

import { useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { SUPPORTED_NETWORKS } from '@/lib/constants';
import NetworkSyncRow from './NetworkSyncRow';
import SyncHistoryDrawer from './SyncHistoryDrawer';
import { useManualRefresh } from '../hooks/useManualRefresh';

export default function ManualRefreshPanel() {
  const {
    networkStates,
    isInitialLoading,
    triggeredNetworks,
    allRateLimit,
    networkRateLimits,
    triggerAll,
    triggerNetwork,
    historyOpen,
    openHistory,
    closeHistory,
  } = useManualRefresh();

  const [confirmingAll, setConfirmingAll] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);

  const noNetworks = !isInitialLoading && networkStates.every(n => n.lastSyncStatus === 'never');

  if (noNetworks) {
    return (
      <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
        No networks configured.{' '}
        <a href="/settings" className="text-blue-600 underline">Go to Settings</a> to add API keys.
      </div>
    );
  }

  const handleRefreshAll = async () => {
    setSyncingAll(true);
    try {
      await triggerAll();
    } finally {
      setSyncingAll(false);
      setConfirmingAll(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Data Sync</h3>
        <button onClick={openHistory} className="text-xs text-blue-600 hover:underline">
          View Sync History
        </button>
      </div>

      {/* Refresh All */}
      <div className="relative mb-4">
        <button
          onClick={() => {
            if (!confirmingAll) { setConfirmingAll(true); return; }
            setConfirmingAll(false);
            handleRefreshAll();
          }}
          disabled={syncingAll || allRateLimit !== null}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
        >
          {syncingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {syncingAll
            ? 'Syncing…'
            : allRateLimit !== null
            ? `Available in ${allRateLimit.countdown}s`
            : confirmingAll
            ? 'Confirm Sync All'
            : 'Refresh All Data Now'}
        </button>
        {confirmingAll && !syncingAll && (
          <div className="absolute left-0 right-0 top-full mt-1 z-10 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2">
            <span>This will sync all active networks — continue?</span>
            <button onClick={() => setConfirmingAll(false)} className="text-amber-600 dark:text-amber-400 hover:underline flex-shrink-0">
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Network rows */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {isInitialLoading
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
          : networkStates.map(n => (
              <NetworkSyncRow
                key={n.networkId}
                networkId={n.networkId}
                lastSyncedAt={n.lastSyncedAt}
                lastSyncStatus={n.lastSyncStatus}
                isRefreshing={triggeredNetworks.has(n.networkId)}
                rateLimitCountdown={networkRateLimits[n.networkId]?.countdown ?? null}
                onRefresh={() => triggerNetwork(n.networkId)}
              />
            ))}
      </div>

      <SyncHistoryDrawer isOpen={historyOpen} onClose={closeHistory} />
    </div>
  );
}
