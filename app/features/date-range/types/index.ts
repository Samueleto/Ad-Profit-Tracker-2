// Step 115: Date range types and Zustand store shape

export type PresetOption = 'last7' | 'last14' | 'last30' | 'last90' | 'thisMonth' | 'custom';

export type DataAvailabilityStatus = 'loading' | 'complete' | 'partial' | 'none' | 'error';

export interface DateRange {
  preset: PresetOption;
  fromDate: string; // YYYY-MM-DD
  toDate: string; // YYYY-MM-DD
  isCustom: boolean;
}

export interface DateRangeState extends DateRange {
  dataAvailability: DataAvailabilityStatus;
  lastSynced: string | null; // ISO timestamp
  pendingFromDate: string | null;
  pendingToDate: string | null;
}
