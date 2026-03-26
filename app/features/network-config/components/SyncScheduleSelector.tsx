'use client';

import type { SyncSchedule } from '../types';

interface SyncScheduleSelectorProps {
  value: SyncSchedule;
  onChange: (schedule: SyncSchedule) => void;
  disabled?: boolean;
}

const OPTIONS: { label: string; value: SyncSchedule }[] = [
  { label: 'Hourly', value: 'hourly' },
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Manual', value: 'manual' },
];

export default function SyncScheduleSelector({ value, onChange, disabled }: SyncScheduleSelectorProps) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as SyncSchedule)}
      disabled={disabled}
      className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white disabled:opacity-50"
    >
      {OPTIONS.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
