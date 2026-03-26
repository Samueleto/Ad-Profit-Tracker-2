import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/firestore";
import type { AppNotification } from "@/features/notifications/types";

export type DateRange = "last_7_days" | "last_14_days" | "last_30_days" | "this_month" | "custom";

interface CustomDateRange {
  startDate: string | null;
  endDate: string | null;
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

// ─── Notification slice ───────────────────────────────────────────────────────

interface NotificationsSlice {
  notificationItems: AppNotification[];
  unreadCount: number;
  notificationsHasMore: boolean;
  notificationsNextCursor: string | null;
  notificationPanelOpen: boolean;
  notificationsLoading: boolean;
  notificationsLoadingMore: boolean;
  notificationsError: string | null;
}

// Legacy shape (kept for existing BellIconTrigger / NotificationCenterPanel)
interface LegacyNotificationState {
  unreadCount: number;
  panelOpen: boolean;
}

// ─── Store interface ──────────────────────────────────────────────────────────

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

  // Legacy notification shape (for existing BellIconTrigger / panel)
  notifications: LegacyNotificationState;

  // Full notifications slice
  notificationsSlice: NotificationsSlice;
  openPanel: () => void;
  closePanel: () => void;
  setNotificationPanelOpen: (open: boolean) => void;
  setUnreadCount: (count: number) => void;
  fetchNotifications: () => Promise<void>;
  fetchMoreNotifications: () => Promise<void>;
  dismissNotification: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  clearAll: () => Promise<void>;
  hydrateBadgeFromFirestore: () => Promise<void>;

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const defaultNotificationsSlice: NotificationsSlice = {
  notificationItems: [],
  unreadCount: 0,
  notificationsHasMore: false,
  notificationsNextCursor: null,
  notificationPanelOpen: false,
  notificationsLoading: false,
  notificationsLoadingMore: false,
  notificationsError: null,
};

async function getToken(): Promise<string | null> {
  const auth = getAuth();
  try {
    return (await auth.currentUser?.getIdToken()) ?? null;
  } catch {
    return null;
  }
}

function authHeaders(token: string | null): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

function updateSlice(
  set: (fn: (s: DashboardStore) => Partial<DashboardStore>) => void,
  patch: Partial<NotificationsSlice>
) {
  set((s) => {
    const next = { ...s.notificationsSlice, ...patch };
    return {
      notificationsSlice: next,
      // Keep legacy shape in sync
      notifications: { unreadCount: next.unreadCount, panelOpen: next.notificationPanelOpen },
    };
  });
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useDashboardStore = create<DashboardStore>()(
  persist(
    (set, get) => ({
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

      // ─── Legacy notification state (for existing components) ───────────────
      notifications: { unreadCount: 0, panelOpen: false },

      // ─── Full notifications slice ────────────────────────────────────────────
      notificationsSlice: defaultNotificationsSlice,

      openPanel: () => {
        const slice = get().notificationsSlice;
        updateSlice(set, { notificationPanelOpen: true });
        if (slice.notificationItems.length === 0) {
          get().fetchNotifications();
        }
      },

      closePanel: () => updateSlice(set, { notificationPanelOpen: false }),

      // Legacy aliases kept for backward compatibility
      setNotificationPanelOpen: (open) => {
        if (open) get().openPanel(); else get().closePanel();
      },
      setUnreadCount: (count) => updateSlice(set, { unreadCount: count }),

      fetchNotifications: async () => {
        const token = await getToken();
        updateSlice(set, { notificationsLoading: true, notificationsError: null });
        try {
          const res = await fetch('/api/notifications?limit=20', { headers: authHeaders(token) });
          if (!res.ok) throw new Error(`Request failed: ${res.status}`);
          const data = await res.json();
          updateSlice(set, {
            notificationItems: data.notifications ?? [],
            unreadCount: data.unreadCount ?? 0,
            notificationsHasMore: data.hasMore ?? false,
            notificationsNextCursor: data.nextCursor ?? null,
            notificationsLoading: false,
          });
        } catch (err) {
          updateSlice(set, {
            notificationsLoading: false,
            notificationsError: err instanceof Error ? err.message : 'Failed to load notifications.',
          });
        }
      },

      fetchMoreNotifications: async () => {
        const slice = get().notificationsSlice;
        if (!slice.notificationsHasMore || !slice.notificationsNextCursor || slice.notificationsLoadingMore) return;
        const token = await getToken();
        updateSlice(set, { notificationsLoadingMore: true, notificationsError: null });
        try {
          const params = new URLSearchParams({ limit: '20', cursor: slice.notificationsNextCursor });
          const res = await fetch(`/api/notifications?${params}`, { headers: authHeaders(token) });
          if (!res.ok) throw new Error(`Request failed: ${res.status}`);
          const data = await res.json();
          updateSlice(set, {
            notificationItems: [...slice.notificationItems, ...(data.notifications ?? [])],
            notificationsHasMore: data.hasMore ?? false,
            notificationsNextCursor: data.nextCursor ?? null,
            notificationsLoadingMore: false,
          });
        } catch (err) {
          updateSlice(set, {
            notificationsLoadingMore: false,
            notificationsError: err instanceof Error ? err.message : 'Failed to load more notifications.',
          });
        }
      },

      dismissNotification: async (id: string) => {
        const slice = get().notificationsSlice;
        const index = slice.notificationItems.findIndex((n) => n.id === id);
        const item = slice.notificationItems[index];
        if (!item) return;
        const wasUnread = !item.isRead;
        // Optimistic remove
        updateSlice(set, {
          notificationItems: slice.notificationItems.filter((n) => n.id !== id),
          unreadCount: wasUnread ? Math.max(0, slice.unreadCount - 1) : slice.unreadCount,
        });
        try {
          const token = await getToken();
          const res = await fetch(`/api/notifications/dismiss/${id}`, {
            method: 'PATCH',
            headers: authHeaders(token),
          });
          if (!res.ok) throw new Error('dismiss failed');
        } catch {
          // Rollback
          const current = get().notificationsSlice;
          const restored = [...current.notificationItems];
          restored.splice(index, 0, item);
          updateSlice(set, {
            notificationItems: restored,
            unreadCount: wasUnread ? current.unreadCount + 1 : current.unreadCount,
          });
        }
      },

      markAllRead: async () => {
        const slice = get().notificationsSlice;
        const previous = slice.notificationItems;
        const previousCount = slice.unreadCount;
        // Optimistic
        updateSlice(set, {
          notificationItems: slice.notificationItems.map((n) => ({ ...n, isRead: true })),
          unreadCount: 0,
        });
        try {
          const token = await getToken();
          const res = await fetch('/api/notifications/mark-all-read', {
            method: 'PATCH',
            headers: authHeaders(token),
          });
          if (!res.ok) throw new Error('mark-all-read failed');
        } catch {
          updateSlice(set, { notificationItems: previous, unreadCount: previousCount });
        }
      },

      clearAll: async () => {
        const slice = get().notificationsSlice;
        const previous = slice.notificationItems;
        const previousCount = slice.unreadCount;
        // Optimistic
        updateSlice(set, { notificationItems: [], unreadCount: 0 });
        try {
          const token = await getToken();
          const res = await fetch('/api/notifications/clear', {
            method: 'DELETE',
            headers: authHeaders(token),
          });
          if (!res.ok) throw new Error('clear failed');
        } catch {
          updateSlice(set, { notificationItems: previous, unreadCount: previousCount });
        }
      },

      hydrateBadgeFromFirestore: async () => {
        const auth = getAuth();
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        try {
          const snap = await getDoc(doc(db, 'users', uid));
          if (snap.exists()) {
            const data = snap.data();
            const count = typeof data.unreadNotificationCount === 'number' ? data.unreadNotificationCount : 0;
            updateSlice(set, { unreadCount: count });
          }
        } catch {
          // Non-critical; badge stays at 0
        }
      },

      // ─── Filters ────────────────────────────────────────────────────────────
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
