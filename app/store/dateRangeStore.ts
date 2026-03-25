// Step 115: Zustand store for date range selection

import { create } from 'zustand';
import { format, subDays, startOfMonth, differenceInDays } from 'date-fns';
import type { PresetOption, DataAvailabilityStatus, DateRangeState } from '@/features/date-range/types';

function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function computePresetDates(preset: PresetOption): { fromDate: string; toDate: string } {
  const today = new Date();
  switch (preset) {
    case 'last7':
      return { fromDate: formatDate(subDays(today, 6)), toDate: formatDate(today) };
    case 'last14':
      return { fromDate: formatDate(subDays(today, 13)), toDate: formatDate(today) };
    case 'last30':
      return { fromDate: formatDate(subDays(today, 29)), toDate: formatDate(today) };
    case 'last90':
      return { fromDate: formatDate(subDays(today, 89)), toDate: formatDate(today) };
    case 'thisMonth':
      return { fromDate: formatDate(startOfMonth(today)), toDate: formatDate(today) };
    case 'custom':
      return { fromDate: formatDate(subDays(today, 29)), toDate: formatDate(today) };
    default:
      return { fromDate: formatDate(subDays(today, 29)), toDate: formatDate(today) };
  }
}

interface DateRangeActions {
  setPreset: (preset: PresetOption) => void;
  setCustomRange: (from: string, to: string) => void;
  applyCustomRange: () => boolean;
  setDataAvailability: (status: DataAvailabilityStatus) => void;
  setLastSynced: (timestamp: string) => void;
}

const initialPreset: PresetOption = 'last30';
const initialDates = computePresetDates(initialPreset);

export const useDateRangeStore = create<DateRangeState & DateRangeActions>((set, get) => ({
  preset: initialPreset,
  fromDate: initialDates.fromDate,
  toDate: initialDates.toDate,
  isCustom: false,
  dataAvailability: 'loading',
  lastSynced: null,
  pendingFromDate: null,
  pendingToDate: null,

  setPreset: (preset: PresetOption) => {
    const dates = computePresetDates(preset);
    set({
      preset,
      fromDate: dates.fromDate,
      toDate: dates.toDate,
      isCustom: preset === 'custom',
      pendingFromDate: null,
      pendingToDate: null,
    });
  },

  setCustomRange: (from: string, to: string) => {
    set({ pendingFromDate: from, pendingToDate: to });
  },

  applyCustomRange: () => {
    const { pendingFromDate, pendingToDate } = get();
    if (!pendingFromDate || !pendingToDate) return false;

    const fromDate = new Date(pendingFromDate);
    const toDate = new Date(pendingToDate);
    const daysDiff = differenceInDays(toDate, fromDate);

    if (daysDiff > 90) return false;
    if (daysDiff < 0) return false;

    set({
      preset: 'custom',
      fromDate: pendingFromDate,
      toDate: pendingToDate,
      isCustom: true,
    });
    return true;
  },

  setDataAvailability: (status: DataAvailabilityStatus) => {
    set({ dataAvailability: status });
  },

  setLastSynced: (timestamp: string) => {
    set({ lastSynced: timestamp });
  },
}));
