'use client';

import { AlertTriangle } from 'lucide-react';
import MetricShareBar from '@/features/geo-breakdown/components/MetricShareBar';

interface BenchmarkComparisonRowProps {
  networkName: string;
  actual: number | null;
  historicalAvg: number | null;
  industryBenchmark: number | null;
  unit: string;
  lastSyncStatus?: string;
  circuitBreakerOpen?: boolean;
  loading?: boolean;
}

function fmt(v: number | null, unit: string): string {
  if (v == null) return '—';
  if (unit === '%') return `${v.toFixed(2)}%`;
  if (unit === '$') return `$${v.toFixed(2)}`;
  return v.toLocaleString();
}

function actualColor(actual: number | null, benchmark: number | null): string {
  if (actual == null || benchmark == null) return 'text-gray-700 dark:text-gray-300';
  const diff = ((actual - benchmark) / benchmark) * 100;
  if (diff >= 10) return 'text-green-600 dark:text-green-400 font-semibold';
  if (diff <= -10) return 'text-red-500 dark:text-red-400 font-semibold';
  return 'text-amber-600 dark:text-amber-400 font-semibold';
}

function shareValue(actual: number | null, benchmark: number | null): number {
  if (actual == null || benchmark == null || benchmark === 0) return 0;
  return Math.min(100, (actual / benchmark) * 100);
}

export default function BenchmarkComparisonRow({
  networkName, actual, historicalAvg, industryBenchmark, unit,
  lastSyncStatus, circuitBreakerOpen, loading,
}: BenchmarkComparisonRowProps) {
  if (loading) {
    return (
      <tr className="animate-pulse">
        {[...Array(5)].map((_, i) => (
          <td key={i} className="px-3 py-2.5">
            <div className="h-3.5 bg-gray-200 dark:bg-gray-700 rounded w-full" />
          </td>
        ))}
      </tr>
    );
  }

  const hasWarning = lastSyncStatus === 'failed' || circuitBreakerOpen;

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <td className="px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100">
        <div className="flex items-center gap-1.5">
          {networkName}
          {hasWarning && (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          )}
        </div>
      </td>
      <td className={`px-3 py-2.5 text-sm ${actualColor(actual, industryBenchmark)}`}>
        {fmt(actual, unit)}
      </td>
      <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-400">{fmt(historicalAvg, unit)}</td>
      <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-400">{fmt(industryBenchmark, unit)}</td>
      <td className="px-3 py-2.5 w-24">
        <MetricShareBar value={shareValue(actual, industryBenchmark)} />
      </td>
    </tr>
  );
}
