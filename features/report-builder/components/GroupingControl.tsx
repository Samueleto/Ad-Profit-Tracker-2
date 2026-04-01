'use client';

import { ALLOWED_GROUPBY, type ReportGroupBy } from '../types';

const GROUPBY_LABELS: Record<ReportGroupBy, string> = {
  daily: 'Daily',
  country: 'Country',
  network: 'Network',
};

interface GroupingControlProps {
  value: string;
  onChange: (groupBy: string) => void;
}

export default function GroupingControl({ value, onChange }: GroupingControlProps) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Grouping</h3>
      <div className="inline-flex rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-0.5 gap-0.5">
        {ALLOWED_GROUPBY.map(option => (
          <button
            key={option}
            onClick={() => onChange(option)}
            className={`px-4 py-1.5 text-xs font-medium rounded-full transition-colors ${
              value === option
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {GROUPBY_LABELS[option]}
          </button>
        ))}
      </div>
    </div>
  );
}
