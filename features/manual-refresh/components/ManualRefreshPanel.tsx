'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, RefreshCw, ShieldAlert, AlertTriangle, AlertCircle } from 'lucide-react';
import { SUPPORTED_NETWORKS } from '@/lib/constants';
import NetworkSyncRow from './NetworkSyncRow';
import SyncHistoryDrawer from './SyncHistoryDrawer';
import { useManualRefresh } from '../hooks/useManualRefresh';
import { toast } from 'sonner';

function formatCountdown(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function ManualRefreshPanel() {
  const {
    networkStates,
    isInitialLoading,
    initLoadError,
    pollingStale,
    retryInitialLoad,
    triggeredNetworks,
    triggerError,
    allRateLimit,
    networkRateLimits,
    triggerAll,
    triggerNetwork,
    historyOpen,
    historyLoading,
    historyData,
    historyError,
    openHistory,
    closeHistory,
    retryHistory,
    sessionExpired,
    accessDenied,
  } = useManualRefresh();

  const router = useRouter();
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);

  useEffect(() => {
    if (sessionExpired) {
      toast.error('Session expired. Please sign in again.');
      router.replace('/');
    }
  }, [sessionExpired, router]);

  useEffect(() => {
    if (triggerError) toast.error(triggerError);
  }, [triggerError]);

  const noNetworks = !isInitialLoading && !initLoadError && networkStates.every(n => n.lastSyncStatus === 'never');

  if (noNetworks) {
    return (
      <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
        No networks configured.{' '}
        <Link href="/settings" className="text-blue-600 underline">Go to Settings</Link> to add API keys.
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
    <>
    {accessDenied && (
      <div className="flex items-center gap-2 p-3 mb-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
        <ShieldAlert className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1">Access Denied — you don&apos;t have permission to sync networks.</span>
        <Link href="/dashboard" className="text-xs underline flex-shrink-0">Go to Dashboard</Link>
      </div>
    )}
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Data Sync</h3>
        <button onClick={openHistory} className="text-xs text-blue-600 hover:underline">
          View Sync History
        </button>
      </div>

      {/* Initial load error */}
      {initLoadError && !isInitialLoading && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{initLoadError}</span>
          <button
            onClick={retryInitialLoad}
            className="text-xs text-red-700 dark:text-red-400 underline whitespace-nowrap"
          >
            Retry
          </button>
        </div>
      )}

      {/* Polling stale warning */}
      {pollingStale && (
        <div className="flex items-center gap-2 px-3 py-2 mb-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg text-xs text-amber-700 dark:text-amber-400">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="flex-1">Status may be outdated —{' '}
            <button onClick={retryInitialLoad} className="underline">click to refresh</button>
          </span>
        </div>
      )}

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
            ? `Available in ${formatCountdown(allRateLimit.countdown)}`
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
                lastSyncError={n.lastSyncError}
                isRefreshing={triggeredNetworks.has(n.networkId)}
                rateLimitCountdown={networkRateLimits[n.networkId]?.countdown ?? null}
                onRefresh={() => triggerNetwork(n.networkId)}
              />
            ))}
      </div>

      <SyncHistoryDrawer
        isOpen={historyOpen}
        onClose={closeHistory}
        loading={historyLoading}
        events={historyData}
        error={historyError}
        onRetry={retryHistory}
      />
    </div>
    </>
  );
}
