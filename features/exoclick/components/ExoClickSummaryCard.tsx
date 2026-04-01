'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ExoClickSummaryCardProps {
  label: string;
  value: number | null;
  format: 'currency' | 'number' | 'percent';
  trend?: number | null; // positive = up, negative = down
}

function formatValue(value: number | null, fmt: 'currency' | 'number' | 'percent'): string {
  if (value === null || value === undefined) return '—';
  switch (fmt) {
    case 'currency': return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'percent': return `${value.toFixed(2)}%`;
    case 'number': return value.toLocaleString('en-US');
  }
}

export default function ExoClickSummaryCard({ label, value, format, trend }: ExoClickSummaryCardProps) {
  const TrendIcon = trend == null ? null : trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor = trend == null ? '' : trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-500' : 'text-gray-400';

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900 dark:text-white">{formatValue(value, format)}</p>
      {TrendIcon && (
        <div className={`flex items-center gap-1 mt-1 text-xs ${trendColor}`}>
          <TrendIcon className="w-3.5 h-3.5" />
          <span>{trend! > 0 ? '+' : ''}{trend!.toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}
