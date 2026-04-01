'use client';

import { formatDistanceToNow } from 'date-fns';

type SyncStatusValue = 'success' | 'error' | 'pending';

interface NetworkSummaryRowProps {
  networkId: string;
  networkName: string;
  dataRole: 'cost' | 'revenue';
  primaryMetricValue: number | null;
  lastSyncedAt: string | null;
  syncStatus: SyncStatusValue;
}

const STATUS_DOT: Record<SyncStatusValue, string> = {
  success: 'bg-green-500',
  error: 'bg-red-500',
  pending: 'bg-amber-500',
};

export default function NetworkSummaryRow({
  networkName,
  dataRole,
  primaryMetricValue,
  lastSyncedAt,
  syncStatus,
}: NetworkSummaryRowProps) {
  const relativeTime = lastSyncedAt
    ? formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true })
    : 'Never synced';

  const metricLabel = dataRole === 'revenue' ? 'Revenue' : 'Cost';
  const metricFormatted = primaryMetricValue != null
    ? `$${primaryMetricValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '—';

  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{networkName}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{relativeTime}</p>
      </div>
      <div className="text-right">
        <p className="text-xs text-gray-500 dark:text-gray-400">{metricLabel}</p>
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{metricFormatted}</p>
      </div>
      <span
        className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[syncStatus]}`}
        title={syncStatus}
        aria-label={`Status: ${syncStatus}`}
      />
    </div>
  );
}
