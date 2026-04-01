'use client';

import { useState } from 'react';
import type { DateRangeOption, DateRange } from '../types';
import { clampDateRange } from '../types';
import { format, differenceInDays } from 'date-fns';

interface DateRangePickerProps {
  selectedOption: DateRangeOption;
  dateRange: DateRange;
  onChange: (option: DateRangeOption, range?: DateRange) => void;
}

const PRESETS: { label: string; value: DateRangeOption }[] = [
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 14 Days', value: '14d' },
  { label: 'Last 30 Days', value: '30d' },
  { label: 'This Month', value: 'thisMonth' },
  { label: 'Custom', value: 'custom' },
];

export default function DateRangePicker({ selectedOption, dateRange, onChange }: DateRangePickerProps) {
  const [clamped, setClamped] = useState(false);

  const handlePreset = (option: DateRangeOption) => {
    setClamped(false);
    onChange(option);
  };

  const handleFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const from = new Date(e.target.value);
    if (isNaN(from.getTime())) return;
    const rawRange: DateRange = { from, to: dateRange.to };
    const clamped_ = clampDateRange(rawRange);
    const wasClamped = differenceInDays(rawRange.to, rawRange.from) > 90;
    setClamped(wasClamped);
    onChange('custom', clamped_);
  };

  const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const to = new Date(e.target.value);
    if (isNaN(to.getTime())) return;
    const rawRange: DateRange = { from: dateRange.from, to };
    const clamped_ = clampDateRange(rawRange);
    const wasClamped = differenceInDays(rawRange.to, rawRange.from) > 90;
    setClamped(wasClamped);
    onChange('custom', clamped_);
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-1 gap-1 flex-wrap">
        {PRESETS.map(preset => (
          <button
            key={preset.value}
            onClick={() => handlePreset(preset.value)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              selectedOption === preset.value
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {selectedOption === 'custom' && (
        <div className="flex flex-col gap-1 mt-1 w-full">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              value={format(dateRange.from, 'yyyy-MM-dd')}
              onChange={handleFromChange}
              className="text-xs border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-500">to</span>
            <input
              type="date"
              value={format(dateRange.to, 'yyyy-MM-dd')}
              onChange={handleToChange}
              className="text-xs border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {clamped && (
            <p className="text-xs text-amber-600 dark:text-amber-400">Max range is 90 days</p>
          )}
        </div>
      )}
    </div>
  );
}
