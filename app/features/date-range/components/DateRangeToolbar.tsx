'use client';

import { formatDistanceToNow } from 'date-fns';
import { useDateRangeStore } from '@/store/dateRangeStore';
import PresetPills from './PresetPills';
import CustomDatePicker from './CustomDatePicker';
import DataAvailabilityDot from './DataAvailabilityDot';
import type { PresetOption } from '../types';

export default function DateRangeToolbar() {
  const { preset, lastSynced, setPreset } = useDateRangeStore();

  const handlePresetChange = (p: PresetOption) => {
    setPreset(p);
  };

  const lastSyncedLabel = lastSynced
    ? formatDistanceToNow(new Date(lastSynced), { addSuffix: true })
    : null;

  return (
    <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-2">
      <div className="flex flex-wrap items-center gap-3">
        {/* Left: presets */}
        <PresetPills value={preset} onChange={handlePresetChange} />

        {/* Custom date picker (inline, only when custom is active) */}
        {preset === 'custom' && <CustomDatePicker />}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right: data availability + last synced */}
        <div className="flex items-center gap-3">
          <DataAvailabilityDot />
          {lastSyncedLabel && (
            <span className="text-xs text-gray-400 whitespace-nowrap hidden sm:inline">
              Last synced {lastSyncedLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
