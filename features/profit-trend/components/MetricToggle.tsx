'use client';

import type { ChartMetric } from '../types';

interface MetricToggleProps {
  value: ChartMetric;
  onChange: (metric: ChartMetric) => void;
}

const OPTIONS: { label: string; value: ChartMetric }[] = [
  { label: 'Profit', value: 'profit' },
  { label: 'Revenue', value: 'revenue' },
  { label: 'Cost', value: 'cost' },
  { label: 'ROI', value: 'roi' },
];

export default function MetricToggle({ value, onChange }: MetricToggleProps) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-1 gap-1">
      {OPTIONS.map(option => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            value === option.value
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
