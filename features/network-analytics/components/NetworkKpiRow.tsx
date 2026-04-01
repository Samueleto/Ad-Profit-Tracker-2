'use client';

interface NetworkSummary {
  cost?: number | null;
  revenue?: number | null;
  impressions?: number | null;
  clicks?: number | null;
  ctr?: number | null;
}

interface NetworkKpiRowProps {
  summary: NetworkSummary | null;
  dataRole: 'cost' | 'revenue';
  isLoading?: boolean;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function fmt(v: number | null | undefined, type: 'currency' | 'number' | 'percent'): string {
  if (v == null) return '—';
  if (type === 'currency') return `$${v.toFixed(2)}`;
  if (type === 'percent') return `${v.toFixed(2)}%`;
  return v.toLocaleString();
}

export default function NetworkKpiRow({ summary, dataRole, isLoading }: NetworkKpiRowProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-4 gap-3 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
            <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
            <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const primaryLabel = dataRole === 'cost' ? 'Cost' : 'Revenue';
  const primaryValue = dataRole === 'cost'
    ? fmt(summary?.cost, 'currency')
    : fmt(summary?.revenue, 'currency');

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatCard label={primaryLabel} value={primaryValue} />
      <StatCard label="Impressions" value={fmt(summary?.impressions, 'number')} />
      <StatCard label="Clicks" value={fmt(summary?.clicks, 'number')} />
      <StatCard label="CTR" value={fmt(summary?.ctr, 'percent')} />
    </div>
  );
}
