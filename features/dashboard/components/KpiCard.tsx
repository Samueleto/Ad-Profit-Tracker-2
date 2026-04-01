'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string;
  percentChange?: number | null;
  changeDirection?: 'up' | 'down' | 'neutral';
  isLoading?: boolean;
}

export default function KpiCard({ label, value, percentChange, changeDirection = 'neutral', isLoading }: KpiCardProps) {
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 animate-pulse">
        <div className="h-3.5 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
        <div className="h-7 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
        <div className="h-3 w-20 bg-gray-100 dark:bg-gray-800 rounded" />
      </div>
    );
  }

  const trendColor =
    changeDirection === 'up'
      ? 'text-green-600 dark:text-green-400'
      : changeDirection === 'down'
      ? 'text-red-500 dark:text-red-400'
      : 'text-amber-500 dark:text-amber-400';

  const TrendIcon = changeDirection === 'up' ? TrendingUp : changeDirection === 'down' ? TrendingDown : Minus;

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{value}</p>
      {percentChange != null && (
        <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
          <TrendIcon className="w-3.5 h-3.5" />
          <span>{percentChange > 0 ? '+' : ''}{percentChange.toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}
