'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, subDays, startOfMonth, differenceInDays } from 'date-fns';
import { getAuth } from 'firebase/auth';
import { DayPicker } from 'react-day-picker';
import type { DateRange as DayPickerRange } from 'react-day-picker';
import 'react-day-picker/style.css';
import {
  ChevronDown, ChevronRight, Loader2, AlertTriangle,
  BookOpen, X, Edit2, Trash2, RotateCcw, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import MobileDataTableWrapper, { type TableColumn } from '@/features/mobile/components/MobileDataTableWrapper';
import ExportModal from '@/features/excel-export/components/ExportModal';
import { useDashboardStore } from '@/store/dashboardStore';
import { useDateRangeStore } from '@/store/dateRangeStore';
import ScheduleReportModal from '@/features/report-scheduler/components/ScheduleReportModal';

// ─── Types ────────────────────────────────────────────────────────────────────

type Metric = 'revenue' | 'cost' | 'net_profit' | 'roi' | 'impressions' | 'clicks' | 'ctr' | 'cpm';
type Grouping = 'daily' | 'country' | 'network';
type DataQuality = 'all' | 'clean' | 'anomalies';
type DatePreset = 'last7' | 'last14' | 'last30' | 'last90' | 'month' | 'custom';

const METRIC_LABELS: Record<Metric, string> = {
  revenue: 'Revenue',
  cost: 'Cost',
  net_profit: 'Net Profit',
  roi: 'ROI %',
  impressions: 'Impressions',
  clicks: 'Clicks',
  ctr: 'CTR %',
  cpm: 'CPM',
};
const ALL_METRICS = Object.keys(METRIC_LABELS) as Metric[];

const NETWORKS = ['exoclick', 'rollerads', 'zeydoo', 'propush'] as const;
type Network = typeof NETWORKS[number];
const NETWORK_LABELS: Record<Network, string> = {
  exoclick: 'ExoClick', rollerads: 'RollerAds', zeydoo: 'Zeydoo', propush: 'Propush',
};

const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: 'last7', label: 'Last 7 Days' },
  { id: 'last14', label: 'Last 14 Days' },
  { id: 'last30', label: 'Last 30 Days' },
  { id: 'last90', label: 'Last 90 Days' },
  { id: 'month', label: 'This Month' },
  { id: 'custom', label: 'Custom' },
];

interface ReportConfig {
  metrics: Metric[];
  networks: Network[];
  dateFrom: string;
  dateTo: string;
  grouping: Grouping;
  dataQuality: DataQuality;
}

interface ReportRow {
  [key: string]: string | number | null;
}

interface SavedReport {
  id: string;
  name: string;
  config: ReportConfig;
  createdAt: string;
}

// ─── Auth fetch ───────────────────────────────────────────────────────────────
// Tries with cached token first; retries once with a force-refreshed token on
// 401 so short-lived token expiry is handled transparently.

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const auth = getAuth();
  const buildReq = (token?: string) =>
    fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers as Record<string, string> ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  let token = await auth.currentUser?.getIdToken(false);
  let res = await buildReq(token);
  if (res.status === 401) {
    // Force-refresh and retry once — handles near-expired tokens
    token = await auth.currentUser?.getIdToken(true);
    res = await buildReq(token);
  }
  return res;
}

function presetToRange(preset: DatePreset): { from: string; to: string } {
  const today = new Date();
  const to = format(today, 'yyyy-MM-dd');
  switch (preset) {
    case 'last7': return { from: format(subDays(today, 6), 'yyyy-MM-dd'), to };
    case 'last14': return { from: format(subDays(today, 13), 'yyyy-MM-dd'), to };
    case 'last30': return { from: format(subDays(today, 29), 'yyyy-MM-dd'), to };
    case 'last90': return { from: format(subDays(today, 89), 'yyyy-MM-dd'), to };
    case 'month': return { from: format(startOfMonth(today), 'yyyy-MM-dd'), to };
    default: return { from: format(subDays(today, 29), 'yyyy-MM-dd'), to };
  }
}

// ─── Saved Reports Sidebar ────────────────────────────────────────────────────

interface SavedReportsSidebarProps {
  open: boolean;
  onClose: () => void;
  onLoad: (config: ReportConfig) => void;
  onSchedule: (report: SavedReport) => void;
  scheduleRefreshKey: number;
}

function SavedReportsSidebar({ open, onClose, onLoad, onSchedule, scheduleRefreshKey }: SavedReportsSidebarProps) {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [scheduledIds, setScheduledIds] = useState<Set<string>>(new Set());

  const fetchReports = useCallback(async () => {
    setLoading(true);
    const res = await authFetch('/api/reports').catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      setReports(data?.reports ?? data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) {
      fetchReports();
      authFetch('/api/schedules')
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          const schedules: { reportId: string }[] = data?.schedules ?? data ?? [];
          setScheduledIds(new Set(schedules.map(s => s.reportId).filter(Boolean)));
        })
        .catch(() => {});
    }
  }, [open, fetchReports, scheduleRefreshKey]);

  async function handleRename(id: string) {
    if (!renameVal.trim()) return;
    const res = await authFetch(`/api/reports/${id}`, { method: 'PATCH', body: JSON.stringify({ name: renameVal }) });
    setRenaming(null);
    if (res.ok) {
      toast.success('Report renamed');
    }
    fetchReports();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this saved report?')) return;
    setDeleting(id);
    const res = await authFetch(`/api/reports/${id}`, { method: 'DELETE' });
    setDeleting(null);
    if (res.ok) {
      toast.success('Report deleted');
    }
    fetchReports();
  }

  const content = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Saved Reports</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
            ))
          : reports.length === 0
          ? <p className="text-xs text-gray-400 text-center py-4">No saved reports yet.</p>
          : reports.map(r => (
              <div key={r.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 space-y-1.5">
                {renaming === r.id ? (
                  <div className="flex gap-1.5">
                    <input
                      value={renameVal}
                      onChange={e => setRenameVal(e.target.value)}
                      className="flex-1 text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                    />
                    <button onClick={() => handleRename(r.id)} className="text-xs text-blue-600 font-medium px-1.5">Save</button>
                    <button onClick={() => setRenaming(null)} className="text-xs text-gray-400 px-1">Cancel</button>
                  </div>
                ) : (
                  <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{r.name}</p>
                )}
                <div className="flex gap-2">
                  <button onClick={() => { onLoad(r.config); onClose(); }} className="text-xs text-blue-600 hover:underline">Load</button>
                  <button onClick={() => { setRenaming(r.id); setRenameVal(r.name); }} className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button onClick={() => onSchedule(r)} className={`text-xs transition-colors ${scheduledIds.has(r.id) ? 'text-blue-500' : 'text-gray-400 hover:text-blue-500 dark:hover:text-blue-400'}`} title="Schedule report">
                    <Clock className={`w-3 h-3 ${scheduledIds.has(r.id) ? 'fill-current' : ''}`} />
                  </button>
                  <button onClick={() => handleDelete(r.id)} disabled={deleting === r.id} className="text-xs text-red-400 hover:text-red-500">
                    {deleting === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            ))
        }
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop drawer */}
      <div className={`hidden lg:flex flex-col w-64 shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 transition-all ${open ? 'translate-x-0' : '-translate-x-full absolute'}`}>
        {open && content}
      </div>
      {/* Mobile bottom sheet */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <div className="relative bg-white dark:bg-gray-900 rounded-t-2xl max-h-[70vh] flex flex-col">
            {content}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CustomReportBuilderPage() {
  const { setExportModalOpen, exportModalOpen } = useDashboardStore();
  const { setCustomRange: syncExportDateRange, applyCustomRange } = useDateRangeStore();
  const router = useRouter();
  const searchParams = useSearchParams();

  const today = new Date();
  const [config, setConfig] = useState<ReportConfig>({
    metrics: [...ALL_METRICS],
    networks: [...NETWORKS],
    dateFrom: format(subDays(today, 29), 'yyyy-MM-dd'),
    dateTo: format(today, 'yyyy-MM-dd'),
    grouping: 'daily',
    dataQuality: 'all',
  });

  const [datePreset, setDatePreset] = useState<DatePreset>('last30');
  const [customRange, setCustomRange] = useState<DayPickerRange | undefined>();
  const [dateRangeError, setDateRangeError] = useState('');

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Preview state
  const [previewRows, setPreviewRows] = useState<ReportRow[]>([]);
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'loading' | 'success' | 'empty' | 'error-500' | 'error-404'>('loading');
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const previewDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Section row counts
  const [sectionCounts, setSectionCounts] = useState<Record<string, number>>({});

  // Run report
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Save report
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Inline config validation errors (shown near the relevant control)
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [networksError, setNetworksError] = useState<string | null>(null);

  // Schedule modal
  const [schedulingReport, setSchedulingReport] = useState<SavedReport | null>(null);
  const [scheduleRefreshKey, setScheduleRefreshKey] = useState(0);

  // ─── Preview fetch ───────────────────────────────────────────────────────────

  const fetchPreview = useCallback(async (cfg: ReportConfig) => {
    setPreviewStatus('loading');
    try {
      const params = new URLSearchParams({
        dateFrom: cfg.dateFrom,
        dateTo: cfg.dateTo,
        metrics: cfg.metrics.join(','),
        networks: cfg.networks.join(','),
        groupBy: cfg.grouping,
        quality: cfg.dataQuality,
        limit: '20',
      });
      const res = await authFetch(`/api/filters/stats?${params}`);
      if (res.status === 404) { setPreviewStatus('error-404'); return; }
      if (!res.ok) { setPreviewStatus('error-500'); return; }
      const data = await res.json();
      const rows: ReportRow[] = data?.rows ?? data ?? [];
      setPreviewRows(rows);
      setPreviewStatus(rows.length === 0 ? 'empty' : 'success');
      setPreviewLoaded(true);
    } catch {
      setPreviewStatus('error-500');
    }
  }, []);

  const fetchSectionCounts = useCallback(async (cfg: ReportConfig) => {
    const res = await authFetch(`/api/export/preview?from=${cfg.dateFrom}&to=${cfg.dateTo}`).catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      setSectionCounts(data?.sheets ?? {});
    }
  }, []);

  // Debounced preview on config change
  useEffect(() => {
    if (dateRangeError) return;
    if (previewDebounce.current) clearTimeout(previewDebounce.current);
    previewDebounce.current = setTimeout(() => {
      fetchPreview(config);
      fetchSectionCounts(config);
    }, 300);
    return () => { if (previewDebounce.current) clearTimeout(previewDebounce.current); };
  }, [config, dateRangeError, fetchPreview, fetchSectionCounts]);

  // Deep-link: auto-load saved report if ?reportId= is in the URL
  useEffect(() => {
    const reportId = searchParams.get('reportId');
    if (!reportId) return;
    authFetch('/api/reports')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        const reports: SavedReport[] = data?.reports ?? data ?? [];
        const match = reports.find(r => r.id === reportId);
        if (match) loadReport(match.config);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Config helpers ──────────────────────────────────────────────────────────

  function updateConfig(patch: Partial<ReportConfig>) {
    setConfig(prev => ({ ...prev, ...patch }));
  }

  function toggleMetric(m: Metric) {
    updateConfig({ metrics: config.metrics.includes(m) ? config.metrics.filter(x => x !== m) : [...config.metrics, m] });
  }

  function toggleNetwork(n: Network) {
    updateConfig({ networks: config.networks.includes(n) ? config.networks.filter(x => x !== n) : [...config.networks, n] });
  }

  function applyPreset(preset: DatePreset) {
    setDatePreset(preset);
    setDateRangeError('');
    if (preset !== 'custom') {
      const { from, to } = presetToRange(preset);
      updateConfig({ dateFrom: from, dateTo: to });
    }
  }

  function handleCustomRange(range: DayPickerRange | undefined) {
    setCustomRange(range);
    if (range?.from && range?.to) {
      const days = differenceInDays(range.to, range.from);
      if (days > 90) {
        setDateRangeError('Date range exceeds 90-day maximum.');
      } else {
        setDateRangeError('');
        updateConfig({
          dateFrom: format(range.from, 'yyyy-MM-dd'),
          dateTo: format(range.to, 'yyyy-MM-dd'),
        });
      }
    }
  }

  function loadReport(savedConfig: ReportConfig) {
    setConfig(savedConfig);
    const preset = DATE_PRESETS.find(p => {
      if (p.id === 'custom') return false;
      const { from, to } = presetToRange(p.id);
      return from === savedConfig.dateFrom && to === savedConfig.dateTo;
    });
    setDatePreset(preset?.id ?? 'custom');
    setDateRangeError('');
  }

  // ─── Export ───────────────────────────────────────────────────────────────────

  function handleOpenExport() {
    syncExportDateRange(config.dateFrom, config.dateTo);
    applyCustomRange();
    setExportModalOpen(true);
  }

  // ─── Run report ──────────────────────────────────────────────────────────────

  async function handleRunReport() {
    // Validate config client-side — show inline errors before any API call
    let hasValidationError = false;
    if (config.metrics.length === 0) { setMetricsError('Select at least one metric.'); hasValidationError = true; } else setMetricsError(null);
    if (config.networks.length === 0) { setNetworksError('Select at least one network.'); hasValidationError = true; } else setNetworksError(null);
    if (hasValidationError) return;

    setRunning(true);
    setRunError(null);
    setNextCursor(null);
    try {
      const res = await authFetch('/api/reports/run', {
        method: 'POST',
        body: JSON.stringify({ ...config, limit: 100 }),
      });
      if (res.status === 401) {
        toast.error('Session expired. Please sign in again.');
        setTimeout(() => router.push('/'), 1500);
        return;
      }
      if (!res.ok) { setRunError('Failed to run report. Please try again.'); return; }
      const data = await res.json();
      setPreviewRows(data?.rows ?? []);
      setNextCursor(data?.nextCursor ?? null);
      setPreviewStatus(data?.rows?.length === 0 ? 'empty' : 'success');
    } catch {
      setRunError('Failed to run report. Please try again.');
    } finally {
      setRunning(false);
    }
  }

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const res = await authFetch('/api/reports/run', {
        method: 'POST',
        body: JSON.stringify({ ...config, limit: 100, cursor: nextCursor }),
      });
      if (res.ok) {
        const data = await res.json();
        setPreviewRows(prev => [...prev, ...(data?.rows ?? [])]);
        setNextCursor(data?.nextCursor ?? null);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  // ─── Save report ─────────────────────────────────────────────────────────────

  async function handleSave() {
    const trimmed = saveName.trim();
    if (!trimmed) return;
    if (trimmed.length > 100) { setSaveError('Report name must be 100 characters or fewer.'); return; }
    if (config.metrics.length === 0) { setSaveError('Select at least one metric before saving.'); return; }
    if (config.networks.length === 0) { setSaveError('Select at least one network before saving.'); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await authFetch('/api/reports/save', {
        method: 'POST',
        body: JSON.stringify({ name: saveName, config }),
      });
      if (res.status === 401) {
        toast.error('Session expired. Please sign in again.');
        setTimeout(() => router.push('/'), 1500);
        return;
      }
      if (res.ok) {
        toast.success('Report saved successfully');
        setSaveOpen(false);
        setSaveName('');
      } else {
        setSaveError('Failed to save report. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  // ─── Table columns ────────────────────────────────────────────────────────────

  const previewCols: TableColumn<ReportRow>[] = config.metrics.slice(0, 6).map((m, i) => ({
    key: m,
    header: METRIC_LABELS[m],
    priority: i < 2 ? 'primary' : 'secondary',
    render: (row) => {
      const val = row[m];
      if (val === null || val === undefined) return '—';
      if (m === 'roi' || m === 'ctr') return `${Number(val).toFixed(2)}%`;
      if (m === 'cpm' || m === 'revenue' || m === 'cost' || m === 'net_profit') return `$${Number(val).toFixed(2)}`;
      return Number(val).toLocaleString();
    },
  }));

  if (config.grouping === 'daily') {
    previewCols.unshift({ key: 'date', header: 'Date', priority: 'primary' });
  } else if (config.grouping === 'country') {
    previewCols.unshift({ key: 'countryName', header: 'Country', priority: 'primary' });
  } else {
    previewCols.unshift({ key: 'networkId', header: 'Network', priority: 'primary' });
  }

  const rangeOk = !dateRangeError;

  return (
    <div className="flex h-full min-h-screen">
      {/* Saved reports sidebar */}
      <SavedReportsSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLoad={loadReport}
        onSchedule={(r) => setSchedulingReport(r)}
        scheduleRefreshKey={scheduleRefreshKey}
      />

      <div className="flex-1 min-w-0">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Custom Report Builder</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Configure, preview, run, and export custom reports.</p>
          </div>
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            Saved Reports
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* ─── Left: Config panel ─────────────────────────────────────────── */}
          <div className="w-full lg:w-[380px] shrink-0 space-y-4">

            {/* 1. Metrics */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Metrics</h3>
                <div className="flex items-center gap-2">
                  {sectionCounts['summary'] != null && (
                    <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded-full">
                      ~{sectionCounts['summary']?.toLocaleString()} rows
                    </span>
                  )}
                  <button
                    onClick={() => updateConfig({ metrics: config.metrics.length === ALL_METRICS.length ? [] : [...ALL_METRICS] })}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {config.metrics.length === ALL_METRICS.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {ALL_METRICS.map(m => (
                  <label key={m} className="flex items-center gap-2 text-xs cursor-pointer text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={config.metrics.includes(m)}
                      onChange={() => { toggleMetric(m); setMetricsError(null); }}
                      className="rounded border-gray-300 text-blue-600"
                    />
                    {METRIC_LABELS[m]}
                  </label>
                ))}
              </div>
              {metricsError && (
                <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {metricsError}
                </p>
              )}
            </div>

            {/* 2. Date Range */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Date Range</h3>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {DATE_PRESETS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => applyPreset(p.id)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                      datePreset === p.id
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {datePreset === 'custom' && (
                <div className="mt-2">
                  <DayPicker
                    mode="range"
                    selected={customRange}
                    onSelect={handleCustomRange}
                    numberOfMonths={1}
                    className="text-xs"
                  />
                </div>
              )}
              {dateRangeError && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {dateRangeError}
                  <button onClick={() => { applyPreset('last30'); setCustomRange(undefined); }} className="underline ml-1">Reset</button>
                </div>
              )}
              {!dateRangeError && (
                <p className="text-xs text-gray-400 mt-2">
                  {config.dateFrom} → {config.dateTo}
                </p>
              )}
            </div>

            {/* 3. Networks */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Networks</h3>
                <button
                  onClick={() => updateConfig({ networks: config.networks.length === NETWORKS.length ? [] : [...NETWORKS] })}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {config.networks.length === NETWORKS.length ? 'Deselect All' : 'All Networks'}
                </button>
              </div>
              <div className="space-y-1.5">
                {NETWORKS.map(n => (
                  <label key={n} className="flex items-center gap-2 text-xs cursor-pointer text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={config.networks.includes(n)}
                      onChange={() => { toggleNetwork(n); setNetworksError(null); }}
                      className="rounded border-gray-300 text-blue-600"
                    />
                    {NETWORK_LABELS[n]}
                  </label>
                ))}
              </div>
              {networksError && (
                <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {networksError}
                </p>
              )}
            </div>

            {/* 4. Grouping */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Grouping</h3>
              <div className="flex border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 p-0.5 gap-0.5">
                {(['daily', 'country', 'network'] as Grouping[]).map(g => (
                  <button
                    key={g}
                    onClick={() => updateConfig({ grouping: g })}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                      config.grouping === g
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* 5. Advanced (Data Quality) */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <button
                onClick={() => setAdvancedOpen(o => !o)}
                className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-gray-200 w-full"
              >
                {advancedOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                Advanced Options
              </button>
              {advancedOpen && (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Data Quality</label>
                  <div className="flex border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 p-0.5 gap-0.5">
                    {(['all', 'clean', 'anomalies'] as DataQuality[]).map(q => (
                      <button
                        key={q}
                        onClick={() => updateConfig({ dataQuality: q })}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                          config.dataQuality === q
                            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                      >
                        {q === 'all' ? 'All' : q === 'clean' ? 'Clean Only' : 'Anomalies'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleRunReport}
                disabled={running || !rangeOk || config.metrics.length === 0 || config.networks.length === 0}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                {running && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Run Report
              </button>
              <button
                onClick={() => setSaveOpen(o => !o)}
                disabled={!previewLoaded}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                Save Report
              </button>
              <button
                onClick={handleOpenExport}
                disabled={!previewLoaded}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                Export
              </button>
            </div>

            {/* Save report inline form */}
            {saveOpen && (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Report name</label>
                <div className="relative">
                  <input
                    type="text"
                    value={saveName}
                    onChange={e => setSaveName(e.target.value.slice(0, 100))}
                    placeholder="My Custom Report"
                    maxLength={100}
                    className="w-full text-sm px-3 py-1.5 pr-16 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                  <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-xs ${saveName.length >= 100 ? 'text-red-500' : 'text-gray-400'}`}>
                    {saveName.length}/100
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving || !saveName.trim() || saveName.length > 100}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
                  >
                    {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                    Save
                  </button>
                  <button onClick={() => { setSaveOpen(false); setSaveError(null); }} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">Cancel</button>
                </div>
                {saveError && (
                  <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {saveError}
                  </p>
                )}
              </div>
            )}

          </div>

          {/* ─── Right: Preview panel ────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Preview</h3>
              <span className="text-xs text-gray-400">{config.dateFrom} → {config.dateTo}</span>
            </div>

            {/* Loading shimmer */}
            {previewStatus === 'loading' && (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-8 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                ))}
              </div>
            )}

            {/* Empty */}
            {previewStatus === 'empty' && (
              <div className="py-12 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  No data matches your current configuration. Adjust filters or sync your networks.
                </p>
                <a href="/dashboard" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">Sync Now →</a>
              </div>
            )}

            {/* 404 */}
            {previewStatus === 'error-404' && (
              <div className="py-12 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">No data found for selected range and filters.</p>
                <button onClick={() => applyPreset('last30')} className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline mx-auto">
                  <RotateCcw className="w-3.5 h-3.5" /> Reset date range
                </button>
              </div>
            )}

            {/* 500 */}
            {previewStatus === 'error-500' && (
              <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                <span>Failed to load preview data.</span>
                <button onClick={() => fetchPreview(config)} className="text-xs underline">Retry</button>
              </div>
            )}

            {/* Run error */}
            {runError && (
              <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400 mb-3">
                <span>{runError}</span>
                <button onClick={handleRunReport} className="text-xs underline">Retry</button>
              </div>
            )}

            {/* Success */}
            {previewStatus === 'success' && previewRows.length > 0 && previewCols.length > 0 && (
              <>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <MobileDataTableWrapper
                    columns={previewCols}
                    data={previewRows}
                    rowKey={(row) => String(row['date'] ?? row['countryCode'] ?? row['networkId'] ?? Math.random())}
                    scrollable
                  />
                </div>
                {nextCursor && (
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="mt-3 flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline mx-auto"
                  >
                    {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Load more
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Export modal */}
      {exportModalOpen && <ExportModal onClose={() => setExportModalOpen(false)} />}

      {/* Schedule modal — mounted at page level to avoid z-index / overflow issues */}
      {schedulingReport && (
        <ScheduleReportModal
          reportId={schedulingReport.id}
          reportName={schedulingReport.name}
          onClose={() => setSchedulingReport(null)}
          onSaved={() => setScheduleRefreshKey(k => k + 1)}
          onDeleted={() => setScheduleRefreshKey(k => k + 1)}
        />
      )}
    </div>
  );
}
