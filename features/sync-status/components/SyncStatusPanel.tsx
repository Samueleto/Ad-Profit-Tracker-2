'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, AlertCircle, ShieldAlert, Clock } from 'lucide-react';
import Link from 'next/link';
import type { NetworkSyncState } from '../types/index';
import HealthBanner from './HealthBanner';
import NetworkStatusCard from './NetworkStatusCard';
import AnomalyAlertStrip from './AnomalyAlertStrip';
import ActivityFeedList from './ActivityFeedList';
import RefreshButton from './RefreshButton';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { Toast } from '@/components/ui/Toast';

export default function SyncStatusPanel() {
  const router = useRouter();
  const {
    networks,
    overallHealth,
    activityFeed,
    criticalAnomalies,
    isLoading,
    isStale,
    error,
    sessionExpired,
    pollingPaused,
    lastPolledAt,
    refresh,
  } = useSyncStatus();

  const [activityOpen, setActivityOpen] = useState(false);

  // Redirect on session expiry via Next.js router
  useEffect(() => {
    if (sessionExpired) {
      router.replace('/');
    }
  }, [sessionExpired, router]);

  // ─── Loading state ─────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <NetworkStatusCard key={i} state={{} as NetworkSyncState} loading />
          ))}
        </div>
      </div>
    );
  }

  // ─── 403 Access Denied ─────────────────────────────────────────────────────

  if (error?.type === '403') {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl text-sm text-red-700 dark:text-red-400">
        <ShieldAlert className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1">Access Denied — you don&apos;t have permission to view sync status.</span>
        <Link href="/dashboard" className="text-xs underline whitespace-nowrap">Go to Dashboard</Link>
      </div>
    );
  }

  // ─── Empty state ───────────────────────────────────────────────────────────

  const noNetworks = networks.length === 0 || networks.every(n => !n.isActive);

  if (noNetworks) {
    return (
      <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
        No networks configured —{' '}
        <Link href="/settings" className="text-blue-600 underline">add API keys in Settings</Link>.
      </div>
    );
  }

  // ─── Main panel ────────────────────────────────────────────────────────────

  return (
    <>
    {sessionExpired && <Toast message="Session expired. Please sign in again." variant="error" />}
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Sync Status</h3>
          {lastPolledAt && (
            <p className="text-[11px] text-gray-400 mt-0.5">
              Last updated {lastPolledAt.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isStale && (
            <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
              <Clock className="w-3 h-3" />
              Data may be stale
            </span>
          )}
          <RefreshButton onRefresh={refresh} />
        </div>
      </div>

      {/* Error banner (500 or network) */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{error.message}</span>
          {pollingPaused && (
            <button onClick={refresh} className="underline flex-shrink-0">Retry</button>
          )}
        </div>
      )}

      {/* Health Banner */}
      <HealthBanner overallHealth={overallHealth} />

      {/* Anomaly Alert Strip */}
      {criticalAnomalies.length > 0 && (
        <AnomalyAlertStrip
          criticalCount={criticalAnomalies.length}
          onViewDetails={() => {
            const el = document.getElementById('reconciliation');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
        />
      )}

      {/* Network Status Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {networks.map(n => (
          <NetworkStatusCard key={n.networkId} state={n} />
        ))}
      </div>

      {/* Recent Activity Section */}
      <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
        <button
          onClick={() => setActivityOpen(o => !o)}
          className="flex items-center gap-1.5 w-full text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${activityOpen ? 'rotate-180' : ''}`} />
          Recent Activity
        </button>
        {activityOpen && (
          <div className="mt-3">
            <ActivityFeedList entries={activityFeed} />
          </div>
        )}
      </div>
    </div>
    </>
  );
}
