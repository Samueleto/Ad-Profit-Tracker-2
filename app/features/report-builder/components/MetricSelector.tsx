'use client';

import { useRef } from 'react';
import { ALLOWED_METRICS, type ReportMetric } from '../types';

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

interface MetricSelectorProps {
  selected: string[];
  onChange: (metrics: string[]) => void;
}

export default function MetricSelector({ selected, onChange }: MetricSelectorProps) {
  const allSelected = selected.length === ALLOWED_METRICS.length;
  const someSelected = selected.length > 0 && !allSelected;
  const selectAllRef = useRef<HTMLInputElement>(null);

  if (selectAllRef.current) {
    selectAllRef.current.indeterminate = someSelected;
  }

  const toggleAll = () => {
    onChange(allSelected ? [] : [...ALLOWED_METRICS]);
  };

  const toggle = (metric: string) => {
    onChange(
      selected.includes(metric)
        ? selected.filter(m => m !== metric)
        : [...selected, metric]
    );
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Metrics</h3>
      <label className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700/50 cursor-pointer">
        <input
          ref={selectAllRef}
          type="checkbox"
          checked={allSelected}
          onChange={toggleAll}
          className="w-3.5 h-3.5 rounded accent-blue-600"
        />
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Select All</span>
      </label>
      <div className="grid grid-cols-2 gap-1.5">
        {ALLOWED_METRICS.map(metric => (
          <label key={metric} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(metric)}
              onChange={() => toggle(metric)}
              className="w-3.5 h-3.5 rounded accent-blue-600"
            />
            <span className="text-xs text-gray-700 dark:text-gray-300">{METRIC_LABELS[metric]}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
