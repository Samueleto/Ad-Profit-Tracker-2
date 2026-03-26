'use client';

import type { MetricKey } from '../types';

const OPTIONS: { label: string; value: MetricKey }[] = [
  { label: 'Revenue', value: 'revenue' },
  { label: 'Cost', value: 'cost' },
  { label: 'Profit', value: 'profit' },
  { label: 'ROI', value: 'roi' },
];

interface MetricPillGroupProps {
  selectedMetric: MetricKey;
  onChange: (metric: MetricKey) => void;
}

export default function MetricPillGroup({ selectedMetric, onChange }: MetricPillGroupProps) {
  return (
    <div className="inline-flex rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-0.5 gap-0.5">
      {OPTIONS.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
            selectedMetric === o.value
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
