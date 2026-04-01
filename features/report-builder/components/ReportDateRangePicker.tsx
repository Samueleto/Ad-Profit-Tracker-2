'use client';

import { useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, differenceInDays } from 'date-fns';
import 'react-day-picker/style.css';

const PRESETS = [
  { label: 'Last 7 Days', value: 'last_7' },
  { label: 'Last 14 Days', value: 'last_14' },
  { label: 'Last 30 Days', value: 'last_30' },
  { label: 'Last 90 Days', value: 'last_90' },
  { label: 'This Month', value: 'this_month' },
] as const;

type PresetValue = typeof PRESETS[number]['value'];

interface ReportDateRangePickerProps {
  preset: string;
  dateFrom: string | null;
  dateTo: string | null;
  onChange: (preset: string, dateFrom: string | null, dateTo: string | null) => void;
}

export default function ReportDateRangePicker({ preset, dateFrom, dateTo, onChange }: ReportDateRangePickerProps) {
  const [customOpen, setCustomOpen] = useState(preset === 'custom');
  const [rangeError, setRangeError] = useState('');
  const [selected, setSelected] = useState<{ from?: Date; to?: Date }>(() => ({
    from: dateFrom ? new Date(dateFrom) : undefined,
    to: dateTo ? new Date(dateTo) : undefined,
  }));

  const handlePreset = (value: PresetValue) => {
    setRangeError('');
    setCustomOpen(false);
    onChange(value, null, null);
  };

  const handleCustomSelect = (range: { from?: Date; to?: Date } | undefined) => {
    setSelected(range ?? {});
    if (!range?.from || !range?.to) return;

    const days = differenceInDays(range.to, range.from);
    if (days > 90) {
      setRangeError('Date range cannot exceed 90 days.');
      return;
    }
    setRangeError('');
    onChange('custom', format(range.from, 'yyyy-MM-dd'), format(range.to, 'yyyy-MM-dd'));
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Date Range</h3>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {PRESETS.map(p => (
          <button
            key={p.value}
            onClick={() => handlePreset(p.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              preset === p.value
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400'
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => { setCustomOpen(v => !v); if (!customOpen) onChange('custom', null, null); }}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            preset === 'custom'
              ? 'border-blue-600 bg-blue-600 text-white'
              : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400'
          }`}
        >
          Custom
        </button>
      </div>

      {rangeError && (
        <p className="text-xs text-red-500 mb-2">{rangeError}</p>
      )}

      {customOpen && (
        <div className="mt-3 border-t border-gray-100 dark:border-gray-700/50 pt-3 overflow-x-auto">
          <DayPicker
            mode="range"
            selected={selected as { from: Date | undefined; to: Date | undefined }}
            onSelect={handleCustomSelect}
            numberOfMonths={2}
            className="text-xs"
          />
        </div>
      )}

      {preset !== 'custom' && dateFrom == null && (
        <p className="text-xs text-gray-400 mt-1">
          Date range computed at report generation time.
        </p>
      )}
      {preset === 'custom' && dateFrom && dateTo && !rangeError && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {dateFrom} → {dateTo}
        </p>
      )}
    </div>
  );
}
