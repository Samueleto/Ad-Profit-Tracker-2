'use client';

import type { DataQualityOption } from '../types';

const OPTIONS: { label: string; value: DataQualityOption }[] = [
  { label: 'All', value: 'all' },
  { label: 'Anomalies', value: 'anomalies' },
  { label: 'Clean', value: 'clean' },
];

interface DataQualityToggleProps {
  dataQuality: DataQualityOption;
  onChange: (value: DataQualityOption) => void;
}

export default function DataQualityToggle({ dataQuality, onChange }: DataQualityToggleProps) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-0.5 gap-0.5">
      {OPTIONS.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
            dataQuality === o.value
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
