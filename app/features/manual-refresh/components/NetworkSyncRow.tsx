'use client';

import { RefreshCw } from 'lucide-react';
import type { NetworkId } from '@/lib/constants';
import SyncStatusBadge, { type SyncStatus } from './SyncStatusBadge';

const NETWORK_LABELS: Record<NetworkId, string> = {
  exoclick: 'ExoClick',
  rollerads: 'RollerAds',
  zeydoo: 'Zeydoo',
  propush: 'Propush',
};

function relativeTime(date: Date | null): string {
  if (!date) return 'Never synced';
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const diffMs = date.getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHr = Math.round(diffMin / 60);
  if (Math.abs(diffSec) < 60) return rtf.format(diffSec, 'second');
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');
  return rtf.format(diffHr, 'hour');
}

interface NetworkSyncRowProps {
  networkId: NetworkId;
  lastSyncedAt: Date | null;
  lastSyncStatus: SyncStatus;
  lastSyncError?: string | null;
  isRefreshing: boolean;
  rateLimitCountdown: number | null; // seconds remaining, null = not rate-limited
  onRefresh: () => void;
}

export default function NetworkSyncRow({
  networkId,
  lastSyncedAt,
  lastSyncStatus,
  lastSyncError,
  isRefreshing,
  rateLimitCountdown,
  onRefresh,
}: NetworkSyncRowProps) {
  const isDisabled = isRefreshing || lastSyncStatus === 'in_progress' || rateLimitCountdown !== null;

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `Available in ${m}m ${s}s` : `Available in ${s}s`;
  };

  const showErrorTooltip = lastSyncStatus === 'failed' && !!lastSyncError;

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{NETWORK_LABELS[networkId]}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{relativeTime(lastSyncedAt)}</p>
      </div>
      {showErrorTooltip ? (
        <span title={lastSyncError ?? undefined}>
          <SyncStatusBadge status={lastSyncStatus} />
        </span>
      ) : (
        <SyncStatusBadge status={lastSyncStatus} />
      )}
      {rateLimitCountdown !== null ? (
        <span className="text-xs text-amber-600 dark:text-amber-400 whitespace-nowrap">
          {formatCountdown(rateLimitCountdown)}
        </span>
      ) : (
        <button
          onClick={onRefresh}
          disabled={isDisabled}
          title="Refresh"
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 disabled:opacity-40 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing || lastSyncStatus === 'in_progress' ? 'animate-spin' : ''}`} />
        </button>
      )}
    </div>
  );
}
