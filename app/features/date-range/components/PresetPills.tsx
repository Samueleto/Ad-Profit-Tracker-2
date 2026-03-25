'use client';

import type { PresetOption } from '../types';

interface PresetPillsProps {
  value: PresetOption;
  onChange: (preset: PresetOption) => void;
}

const PRESETS: { label: string; value: PresetOption }[] = [
  { label: 'Last 7 Days', value: 'last7' },
  { label: 'Last 14 Days', value: 'last14' },
  { label: 'Last 30 Days', value: 'last30' },
  { label: 'Last 90 Days', value: 'last90' },
  { label: 'This Month', value: 'thisMonth' },
  { label: 'Custom', value: 'custom' },
];

export default function PresetPills({ value, onChange }: PresetPillsProps) {
  return (
    <>
      {/* Desktop: pill row */}
      <div className="hidden sm:inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-1 gap-1">
        {PRESETS.map(p => (
          <button
            key={p.value}
            onClick={() => onChange(p.value)}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              value === p.value
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Mobile: native select */}
      <select
        value={value}
        onChange={e => onChange(e.target.value as PresetOption)}
        className="sm:hidden text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {PRESETS.map(p => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>
    </>
  );
}
