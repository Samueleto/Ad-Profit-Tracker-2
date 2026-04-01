'use client';

import type { NetworkComparisonItem } from '../types';
import MetricShareBar from '@/features/geo-breakdown/components/MetricShareBar';

interface NetworkComparisonCardProps {
  item: NetworkComparisonItem;
  networkName: string;
  onNetworkClick: (networkId: string) => void;
}

const HEADER_COLOR: Record<string, string> = {
  exoclick: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  rollerads: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
  zeydoo: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
  propush: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
};

const NAME_COLOR: Record<string, string> = {
  exoclick: 'text-amber-700 dark:text-amber-400',
  rollerads: 'text-green-700 dark:text-green-400',
  zeydoo: 'text-green-700 dark:text-green-400',
  propush: 'text-green-700 dark:text-green-400',
};

const STATUS_DOT: Record<string, string> = {
  synced: 'bg-green-500',
  failed: 'bg-red-500',
  never: 'bg-gray-400',
};

function fmt(v: number | null | undefined, type: 'currency' | 'number' | 'percent'): string {
  if (v == null) return '—';
  if (type === 'currency') return `$${v.toFixed(2)}`;
  if (type === 'percent') return `${v.toFixed(2)}%`;
  return v.toLocaleString();
}

export default function NetworkComparisonCard({ item, networkName, onNetworkClick }: NetworkComparisonCardProps) {
  const headerClass = HEADER_COLOR[item.networkId] ?? 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
  const nameClass = NAME_COLOR[item.networkId] ?? 'text-gray-700 dark:text-gray-300';
  const syncStatus = item.networkStatus.lastSyncStatus === 'success' ? 'synced'
    : item.networkStatus.lastSyncStatus === 'failed' ? 'failed' : 'never';
  const dotClass = STATUS_DOT[syncStatus];

  return (
    <div
      onClick={() => onNetworkClick(item.networkId)}
      className={`border rounded-xl overflow-hidden cursor-pointer hover:shadow-md transition-shadow ${headerClass}`}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-current/10">
        <div className="flex items-center justify-between">
          <span className={`text-sm font-semibold ${nameClass}`}>{networkName}</span>
          <span className={`w-2 h-2 rounded-full ${dotClass}`} title={syncStatus} />
        </div>
      </div>

      {/* Body */}
      <div className="bg-white dark:bg-gray-900 px-4 py-3 space-y-2">
        {/* Primary metric */}
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{item.dataRole === 'cost' ? 'Cost' : 'Revenue'}</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{fmt(item.primaryMetric, 'currency')}</p>
        </div>

        {/* Compact stats */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div><span className="text-gray-500 dark:text-gray-400">Impressions </span><span className="font-medium">{fmt(item.impressions, 'number')}</span></div>
          <div><span className="text-gray-500 dark:text-gray-400">Clicks </span><span className="font-medium">{fmt(item.clicks, 'number')}</span></div>
          <div><span className="text-gray-500 dark:text-gray-400">CTR </span><span className="font-medium">{fmt(item.averageCtr, 'percent')}</span></div>
          <div><span className="text-gray-500 dark:text-gray-400">CPM </span><span className="font-medium">{fmt(item.averageCpm, 'currency')}</span></div>
        </div>

        {/* Metric share bar */}
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">
            Share {item.metricShare != null ? `${item.metricShare.toFixed(1)}%` : '—'}
          </p>
          <MetricShareBar value={item.metricShare ?? 0} />
        </div>
      </div>
    </div>
  );
}
