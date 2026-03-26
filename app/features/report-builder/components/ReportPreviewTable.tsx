'use client';

import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import type { ReportRunRow, ReportMetric } from '../types';

const METRIC_LABELS: Record<ReportMetric, string> = {
  revenue: 'Revenue',
  cost: 'Cost',
  netProfit: 'Net Profit',
  roi: 'ROI%',
  impressions: 'Impressions',
  clicks: 'Clicks',
  ctr: 'CTR%',
  cpm: 'CPM',
};

function formatValue(key: ReportMetric, value: number | undefined): string {
  if (value == null) return '—';
  if (key === 'roi' || key === 'ctr') return `${value.toFixed(2)}%`;
  if (key === 'impressions' || key === 'clicks') return value.toLocaleString();
  return `$${value.toFixed(2)}`;
}

interface ReportPreviewTableProps {
  rows: ReportRunRow[];
  metrics: string[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
}

export default function ReportPreviewTable({
  rows,
  metrics,
  isLoading,
  error,
  hasMore,
  onLoadMore,
  onRetry,
}: ReportPreviewTableProps) {
  const activeMetrics = metrics.filter((m): m is ReportMetric =>
    ['revenue', 'cost', 'netProfit', 'roi', 'impressions', 'clicks', 'ctr', 'cpm'].includes(m)
  );

  if (isLoading && rows.length === 0) {
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="divide-y divide-gray-100 dark:divide-gray-700/50 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-4 py-3 flex gap-4">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24" />
              {activeMetrics.map(m => (
                <div key={m} className="h-3 bg-gray-200 dark:bg-gray-700 rounded flex-1" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl">
        <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
        <div className="flex items-center gap-1 text-sm text-red-700 dark:text-red-300">
          <span>{error}</span>
          <button onClick={onRetry} className="underline hover:no-underline font-medium ml-1">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-8 border border-gray-200 dark:border-gray-700 rounded-xl">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
          No data matches your current configuration. Adjust filters or sync your networks.
        </p>
        <Link href="/sync" className="text-xs text-blue-600 dark:text-blue-400 underline hover:no-underline">
          Sync Now
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Results</span>
        <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
          {rows.length.toLocaleString()} rows
        </span>
      </div>

      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium text-gray-600 dark:text-gray-400">Label</th>
              {activeMetrics.map(m => (
                <th key={m} className="px-3 py-2.5 text-right font-medium text-gray-600 dark:text-gray-400">
                  {METRIC_LABELS[m]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {rows.map((row, idx) => {
              const netProfit = row.netProfit;
              const rowClass = netProfit != null && netProfit < 0
                ? 'bg-red-50/50 dark:bg-red-900/10'
                : netProfit != null && netProfit > 0
                ? 'bg-green-50/50 dark:bg-green-900/10'
                : '';
              return (
                <tr key={`${row.key}-${idx}`} className={`${rowClass} hover:bg-gray-50 dark:hover:bg-gray-800/50`}>
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300 font-medium">{row.label}</td>
                  {activeMetrics.map(m => (
                    <td
                      key={m}
                      className={`px-3 py-2 text-right ${
                        m === 'netProfit' && row[m] != null && (row[m] as number) < 0
                          ? 'text-red-600 dark:text-red-400'
                          : m === 'netProfit' && row[m] != null && (row[m] as number) > 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {formatValue(m, row[m])}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="text-center">
          <button
            onClick={onLoadMore}
            className="px-4 py-2 text-xs font-medium text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            Load More
          </button>
        </div>
      )}
    </div>
  );
}
