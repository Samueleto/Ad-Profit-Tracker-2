'use client';

import MetricShareBar from '@/features/geo-breakdown/components/MetricShareBar';

interface GeoRow {
  countryCode: string;
  countryName: string;
  flagEmoji?: string;
  primaryMetric: number | null;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  metricShare: number;
  colorCode?: string;
}

interface NetworkGeoTableProps {
  rows: GeoRow[];
  dataRole: 'cost' | 'revenue';
  topN?: number;
  isLoading?: boolean;
  onCountryClick?: (countryCode: string) => void;
}

function rowBg(colorCode?: string): string {
  if (colorCode === 'positive') return 'hover:bg-green-50 dark:hover:bg-green-900/10';
  if (colorCode === 'negative') return 'hover:bg-red-50 dark:hover:bg-red-900/10';
  return 'hover:bg-gray-50 dark:hover:bg-gray-800/50';
}

export default function NetworkGeoTable({ rows, dataRole, topN, isLoading, onCountryClick }: NetworkGeoTableProps) {
  const primaryLabel = dataRole === 'cost' ? 'Cost' : 'Revenue';

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex gap-4 py-1">
            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-4 w-16 bg-gray-100 dark:bg-gray-800 rounded" />
            <div className="h-4 w-14 bg-gray-100 dark:bg-gray-800 rounded" />
            <div className="h-4 w-14 bg-gray-100 dark:bg-gray-800 rounded" />
            <div className="h-4 w-10 bg-gray-100 dark:bg-gray-800 rounded" />
            <div className="h-4 w-16 bg-gray-100 dark:bg-gray-800 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const visible = topN ? rows.slice(0, topN) : rows;

  if (!visible.length) {
    return <p className="text-sm text-gray-500 dark:text-gray-400 py-3">No country data available.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            {['Country', primaryLabel, 'Impressions', 'Clicks', 'CTR', 'Share'].map(h => (
              <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {visible.map(row => (
            <tr
              key={row.countryCode}
              onClick={() => onCountryClick?.(row.countryCode)}
              className={`cursor-pointer transition-colors ${rowBg(row.colorCode)}`}
            >
              <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                {row.flagEmoji && <span className="mr-1">{row.flagEmoji}</span>}
                {row.countryName || row.countryCode}
              </td>
              <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                {row.primaryMetric != null ? `$${row.primaryMetric.toFixed(2)}` : '—'}
              </td>
              <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{row.impressions?.toLocaleString() ?? '—'}</td>
              <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{row.clicks?.toLocaleString() ?? '—'}</td>
              <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{row.ctr != null ? `${row.ctr.toFixed(2)}%` : '—'}</td>
              <td className="px-3 py-2">
                <MetricShareBar value={row.metricShare} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
