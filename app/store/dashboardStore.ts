import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DateRange = "last_7_days" | "last_14_days" | "last_30_days" | "this_month" | "custom";

interface CustomDateRange {
  startDate: string | null;
  endDate: string | null;
}

interface NotificationState {
  unreadCount: number;
  panelOpen: boolean;
}

export type MetricFocus = 'revenue' | 'cost' | 'profit' | 'roi';
export type DataQuality = 'all' | 'anomalies' | 'clean';
export type SyncHealth = 'healthy' | 'degraded' | 'critical';

interface FilterState {
  selectedNetworks: string[];
  selectedCountries: string[];
  stagedNetworks: string[];
  stagedCountries: string[];
  minRevenue: number | null;
  maxRevenue: number | null;
  selectedMetric: MetricFocus;
  dataQuality: DataQuality;
  searchQuery: string;
}

export type ExportStatus = 'idle' | 'loading' | 'exporting' | 'success' | 'error';

export interface PreviewData {
  sheets: Array<{ name: string; rowCount: number }>;
  hasData: boolean;
  totalRows: number;
}

interface DashboardStore {
  // Date range
  dateRange: DateRange;
  customDateRange: CustomDateRange;
  setDateRange: (range: DateRange) => void;
  setCustomDateRange: (range: CustomDateRange) => void;

  // Export modal
  exportModalOpen: boolean;
  setExportModalOpen: (open: boolean) => void;
  openExportModal: () => void;
  closeExportModal: () => void;
  exportStatus: ExportStatus;
  setExportStatus: (status: ExportStatus) => void;
  exportError: string | null;
  setExportError: (message: string | null) => void;
  previewData: PreviewData | null;
  setPreviewData: (data: PreviewData | null) => void;
  previewLoading: boolean;
  setPreviewLoading: (loading: boolean) => void;

  // Notification state
  notifications: NotificationState;
  setNotificationPanelOpen: (open: boolean) => void;
  setUnreadCount: (count: number) => void;

  // Filter state
  filters: FilterState;
  setSelectedNetworks: (networks: string[]) => void;
  setSelectedCountries: (countries: string[]) => void;
  setStagedNetworks: (networks: string[]) => void;
  setStagedCountries: (countries: string[]) => void;
  applyFilters: () => void;
  setRevenueRange: (min: number | null, max: number | null) => void;
  setSelectedMetric: (metric: MetricFocus) => void;
  setDataQuality: (quality: DataQuality) => void;
  setSearchQuery: (query: string) => void;
  clearAllFilters: () => void;
  resetFilters: () => void;

  // Active tab
  activeTab: string;
  setActiveTab: (tab: string) => void;

  // Sync health
  health: SyncHealth;
  setHealth: (health: SyncHealth) => void;
}

const defaultFilters: FilterState = {
  selectedNetworks: [],
  selectedCountries: [],
  stagedNetworks: [],
  stagedCountries: [],
  minRevenue: null,
  maxRevenue: null,
  selectedMetric: 'profit',
  dataQuality: 'all',
  searchQuery: '',
};

export const useDashboardStore = create<DashboardStore>()(
  persist(
    (set) => ({
      dateRange: "last_7_days",
      customDateRange: { startDate: null, endDate: null },
      setDateRange: (range) => set({ dateRange: range }),
      setCustomDateRange: (range) => set({ customDateRange: range }),

      exportModalOpen: false,
      setExportModalOpen: (open) => set({ exportModalOpen: open }),
      openExportModal: () => set({ exportModalOpen: true, exportStatus: 'idle', exportError: null }),
      closeExportModal: () => set({ exportModalOpen: false, exportError: null }),
      exportStatus: 'idle',
      setExportStatus: (status) => set({ exportStatus: status }),
      exportError: null,
      setExportError: (message) => set({ exportError: message }),
      previewData: null,
      setPreviewData: (data) => set({ previewData: data }),
      previewLoading: false,
      setPreviewLoading: (loading) => set({ previewLoading: loading }),

      notifications: { unreadCount: 0, panelOpen: false },
      setNotificationPanelOpen: (open) =>
        set((state) => ({ notifications: { ...state.notifications, panelOpen: open } })),
      setUnreadCount: (count) =>
        set((state) => ({ notifications: { ...state.notifications, unreadCount: count } })),

      filters: defaultFilters,
      setSelectedNetworks: (networks) =>
        set((state) => ({ filters: { ...state.filters, selectedNetworks: networks } })),
      setSelectedCountries: (countries) =>
        set((state) => ({ filters: { ...state.filters, selectedCountries: countries } })),
      setStagedNetworks: (networks) =>
        set((state) => ({ filters: { ...state.filters, stagedNetworks: networks } })),
      setStagedCountries: (countries) =>
        set((state) => ({ filters: { ...state.filters, stagedCountries: countries } })),
      applyFilters: () =>
        set((state) => ({
          filters: {
            ...state.filters,
            selectedNetworks: state.filters.stagedNetworks,
            selectedCountries: state.filters.stagedCountries,
          },
        })),
      setRevenueRange: (min, max) =>
        set((state) => ({ filters: { ...state.filters, minRevenue: min, maxRevenue: max } })),
      setSelectedMetric: (metric) =>
        set((state) => ({ filters: { ...state.filters, selectedMetric: metric } })),
      setDataQuality: (quality) =>
        set((state) => ({ filters: { ...state.filters, dataQuality: quality } })),
      setSearchQuery: (query) =>
        set((state) => ({ filters: { ...state.filters, searchQuery: query } })),
      clearAllFilters: () => set({ filters: defaultFilters }),
      resetFilters: () => set({ filters: defaultFilters }),

      activeTab: "overview",
      setActiveTab: (tab) => set({ activeTab: tab }),

      health: 'healthy',
      setHealth: (health) => set({ health }),
    }),
    {
      name: "dashboard-store",
      partialize: (state) => ({
        dateRange: state.dateRange,
        customDateRange: state.customDateRange,
        filters: state.filters,
      }),
    }
  )
);

/** Derived selector: count of non-default active filter dimensions */
export const useActiveFilterCount = () =>
  useDashboardStore((state) => {
    let count = 0;
    if (state.filters.selectedNetworks.length > 0) count++;
    if (state.filters.selectedCountries.length > 0) count++;
    if (state.filters.selectedMetric !== 'profit') count++;
    if (state.filters.dataQuality !== 'all') count++;
    if (state.filters.searchQuery) count++;
    return count;
  });
