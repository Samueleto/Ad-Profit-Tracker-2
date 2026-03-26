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

interface FilterState {
  selectedNetworks: string[];
  selectedCountries: string[];
  minRevenue: number | null;
  maxRevenue: number | null;
  selectedMetric: MetricFocus;
  dataQuality: DataQuality;
  searchQuery: string;
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

  // Notification state
  notifications: NotificationState;
  setNotificationPanelOpen: (open: boolean) => void;
  setUnreadCount: (count: number) => void;

  // Filter state
  filters: FilterState;
  setSelectedNetworks: (networks: string[]) => void;
  setSelectedCountries: (countries: string[]) => void;
  setRevenueRange: (min: number | null, max: number | null) => void;
  setSelectedMetric: (metric: MetricFocus) => void;
  setDataQuality: (quality: DataQuality) => void;
  setSearchQuery: (query: string) => void;
  resetFilters: () => void;

  // Active tab
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const defaultFilters: FilterState = {
  selectedNetworks: [],
  selectedCountries: [],
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
      setRevenueRange: (min, max) =>
        set((state) => ({ filters: { ...state.filters, minRevenue: min, maxRevenue: max } })),
      setSelectedMetric: (metric) =>
        set((state) => ({ filters: { ...state.filters, selectedMetric: metric } })),
      setDataQuality: (quality) =>
        set((state) => ({ filters: { ...state.filters, dataQuality: quality } })),
      setSearchQuery: (query) =>
        set((state) => ({ filters: { ...state.filters, searchQuery: query } })),
      resetFilters: () => set({ filters: defaultFilters }),

      activeTab: "overview",
      setActiveTab: (tab) => set({ activeTab: tab }),
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
