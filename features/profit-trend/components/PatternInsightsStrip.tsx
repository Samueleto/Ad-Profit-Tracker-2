'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { PatternInsights } from '../types';

interface PatternInsightsStripProps {
  insights: PatternInsights | null;
}

function formatValue(value: number | null): string {
  if (value === null) return '—';
  return value >= 0 ? `+$${value.toFixed(2)}` : `-$${Math.abs(value).toFixed(2)}`;
}

function formatPercent(value: number | null): string {
  if (value === null) return '—';
  return value >= 0 ? `+${value.toFixed(1)}%` : `${value.toFixed(1)}%`;
}

export default function PatternInsightsStrip({ insights }: PatternInsightsStripProps) {
  const [expanded, setExpanded] = useState(false);

  if (!insights || (
    !insights.bestDay &&
    !insights.worstDay &&
    insights.longestProfitableStreak === 0 &&
    insights.periodOverPeriodChange === null
  )) {
    return null;
  }

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 mt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 w-full"
      >
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        <span>Pattern Insights</span>
      </button>

      {expanded && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-4 pb-4">
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Best Day</p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {insights.bestDay?.date ?? '—'}
            </p>
            <p className="text-sm font-semibold text-green-600">
              {formatValue(insights.bestDay?.netProfit ?? null)}
            </p>
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Worst Day</p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {insights.worstDay?.date ?? '—'}
            </p>
            <p className="text-sm font-semibold text-red-600">
              {formatValue(insights.worstDay?.netProfit ?? null)}
            </p>
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Profitable Streak</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {insights.longestProfitableStreak}
            </p>
            <p className="text-xs text-gray-500">days</p>
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Period Change</p>
            <p className={`text-2xl font-bold ${
              (insights.periodOverPeriodChange ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatPercent(insights.periodOverPeriodChange)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
