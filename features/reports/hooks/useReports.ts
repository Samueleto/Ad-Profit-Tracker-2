'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAuth } from 'firebase/auth';
import { toast } from 'sonner';
import { differenceInDays } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DatePreset = 'last_7' | 'last_14' | 'last_30' | 'last_90' | 'this_month' | 'custom';
export type GroupBy = 'daily' | 'country' | 'network';
export type DataQuality = 'all' | 'anomalies' | 'clean';

export interface ReportConfig {
  metrics: string[];
  dateRangePreset: DatePreset;
  dateFrom: string | null;
  dateTo: string | null;
  networks: string[];
  groupBy: GroupBy;
  dataQuality: DataQuality;
}

const ALL_METRICS = ['revenue', 'cost', 'profit', 'roi', 'impressions', 'clicks', 'ctr', 'cpm'];
const ALL_NETWORKS = ['exoclick', 'rollerads', 'zeydoo', 'propush'];

const DEFAULT_CONFIG: ReportConfig = {
  metrics: ALL_METRICS,
  dateRangePreset: 'last_30',
  dateFrom: null,
  dateTo: null,
  networks: ALL_NETWORKS,
  groupBy: 'daily',
  dataQuality: 'all',
};

// ─── Shared fetch ─────────────────────────────────────────────────────────────

async function authFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const auth = getAuth();
  const doRequest = async (forceRefresh: boolean) => {
    const token = await auth.currentUser?.getIdToken(forceRefresh);
    return fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers as Record<string, string> ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  };
  let res = await doRequest(false);
  if (res.status === 401) {
    res = await doRequest(true);
    if (res.status === 401) {
      toast.error('Session expired. Please sign in again.');
      window.location.replace('/');
      throw new Error('Session expired.');
    }
  }
  if (!res.ok) {
    const err = new Error(`Request failed: ${res.status}`);
    (err as Error & { status: number }).status = res.status;
    throw err;
  }
  return res.json();
}

// ─── useReportConfig ──────────────────────────────────────────────────────────

export interface UseReportConfigResult {
  config: ReportConfig;
  setMetrics: (v: string[]) => void;
  setDateRangePreset: (v: DatePreset) => void;
  setCustomDateRange: (dateFrom: string, dateTo: string) => void;
  setNetworks: (v: string[]) => void;
  setGroupBy: (v: GroupBy) => void;
  setDataQuality: (v: DataQuality) => void;
  resetConfig: () => void;
  isConfigValid: boolean;
  configAsApiParams: Record<string, string>;
}

export function useReportConfig(): UseReportConfigResult {
  const [config, setConfig] = useState<ReportConfig>(DEFAULT_CONFIG);

  const setMetrics = useCallback((v: string[]) => setConfig(p => ({ ...p, metrics: v })), []);
  const setDateRangePreset = useCallback((v: DatePreset) => setConfig(p => ({ ...p, dateRangePreset: v, ...(v !== 'custom' ? { dateFrom: null, dateTo: null } : {}) })), []);
  const setCustomDateRange = useCallback((dateFrom: string, dateTo: string) => setConfig(p => ({ ...p, dateRangePreset: 'custom', dateFrom, dateTo })), []);
  const setNetworks = useCallback((v: string[]) => setConfig(p => ({ ...p, networks: v })), []);
  const setGroupBy = useCallback((v: GroupBy) => setConfig(p => ({ ...p, groupBy: v })), []);
  const setDataQuality = useCallback((v: DataQuality) => setConfig(p => ({ ...p, dataQuality: v })), []);
  const resetConfig = useCallback(() => setConfig(DEFAULT_CONFIG), []);

  const isConfigValid = (
    config.metrics.length > 0 &&
    config.networks.length > 0 &&
    (config.dateRangePreset !== 'custom' || (
      !!config.dateFrom && !!config.dateTo &&
      differenceInDays(new Date(config.dateTo), new Date(config.dateFrom)) <= 90 &&
      differenceInDays(new Date(config.dateTo), new Date(config.dateFrom)) >= 0
    ))
  );

  const configAsApiParams: Record<string, string> = {
    metrics: config.metrics.join(','),
    networks: config.networks.join(','),
    groupBy: config.groupBy,
    dataQuality: config.dataQuality,
    ...(config.dateRangePreset !== 'custom' ? { preset: config.dateRangePreset } : {}),
    ...(config.dateFrom ? { dateFrom: config.dateFrom } : {}),
    ...(config.dateTo ? { dateTo: config.dateTo } : {}),
  };

  return { config, setMetrics, setDateRangePreset, setCustomDateRange, setNetworks, setGroupBy, setDataQuality, resetConfig, isConfigValid, configAsApiParams };
}

// ─── useReportPreview ─────────────────────────────────────────────────────────

export function useReportPreview(configParams: Record<string, string>, enabled = true) {
  const [rows, setRows] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [previewCounts, setPreviewCounts] = useState<unknown>(null);
  const [tick, setTick] = useState(0);
  const fetchIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const fetchId = ++fetchIdRef.current;
      setLoading(true);
      setError(null);
      setErrorStatus(null);
      try {
        const params = new URLSearchParams(configParams);
        const data = await authFetch<{ rows?: unknown[] }>(`/api/filters/stats?${params}`);
        if (fetchId !== fetchIdRef.current) return;
        setRows(data.rows ?? []);
        // Also fetch preview counts
        authFetch<unknown>(`/api/export/preview?${params}`)
          .then(d => { if (fetchId === fetchIdRef.current) setPreviewCounts(d); })
          .catch(() => {});
      } catch (err) {
        if (fetchId !== fetchIdRef.current) return;
        const status = (err as Error & { status?: number }).status ?? null;
        setError(err instanceof Error ? err.message : 'Preview failed.');
        setErrorStatus(status);
      } finally {
        if (fetchId === fetchIdRef.current) setLoading(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(configParams), enabled, tick]);

  const refetch = useCallback(() => setTick(n => n + 1), []);

  return { rows, loading, error, errorStatus, previewCounts, refetch };
}

// ─── useRunReport ─────────────────────────────────────────────────────────────

export function useRunReport() {
  const [rows, setRows] = useState<unknown[]>([]);
  const [summary, setSummary] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const run = useCallback(async (config: Record<string, string>) => {
    setLoading(true);
    setError(null);
    setRows([]);
    setNextCursor(null);
    try {
      const data = await authFetch<{ rows?: unknown[]; summary?: unknown; hasMore?: boolean; nextCursor?: string | null }>('/api/reports/run', {
        method: 'POST',
        body: JSON.stringify(config),
      });
      setRows(data.rows ?? []);
      setSummary(data.summary ?? null);
      setHasMore(data.hasMore ?? !!data.nextCursor);
      setNextCursor(data.nextCursor ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Report run failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async (config: Record<string, string>) => {
    if (!hasMore || !nextCursor) return;
    setLoading(true);
    try {
      const data = await authFetch<{ rows?: unknown[]; hasMore?: boolean; nextCursor?: string | null }>('/api/reports/run', {
        method: 'POST',
        body: JSON.stringify({ ...config, cursor: nextCursor }),
      });
      setRows(prev => [...prev, ...(data.rows ?? [])]);
      setHasMore(data.hasMore ?? !!data.nextCursor);
      setNextCursor(data.nextCursor ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more.');
    } finally {
      setLoading(false);
    }
  }, [hasMore, nextCursor]);

  return { rows, summary, loading, error, hasMore, run, loadMore };
}

// ─── useSavedReports ─────────────────────────────────────────────────────────

export interface SavedReport {
  id: string;
  name: string;
  config: ReportConfig;
  createdAt: string;
  updatedAt?: string;
}

export function useSavedReports(applyConfig?: (config: ReportConfig) => void) {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authFetch<{ reports?: SavedReport[] }>('/api/reports')
      .then(d => { setReports(d.reports ?? []); setError(null); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const saveReport = useCallback(async (name: string, config: ReportConfig) => {
    const saved = await authFetch<SavedReport>('/api/reports/save', {
      method: 'POST',
      body: JSON.stringify({ name, config }),
    });
    setReports(prev => [saved, ...prev]);
    return saved;
  }, []);

  const renameReport = useCallback(async (id: string, name: string) => {
    const previous = reports;
    setReports(prev => prev.map(r => r.id === id ? { ...r, name } : r));
    try {
      await authFetch(`/api/reports/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) });
    } catch {
      setReports(previous);
      throw new Error('Failed to rename report.');
    }
  }, [reports]);

  const deleteReport = useCallback(async (id: string) => {
    const previous = reports;
    setReports(prev => prev.filter(r => r.id !== id));
    try {
      await authFetch(`/api/reports/${id}`, { method: 'DELETE' });
    } catch {
      setReports(previous);
      throw new Error('Failed to delete report.');
    }
  }, [reports]);

  const loadReport = useCallback((report: SavedReport) => {
    applyConfig?.(report.config);
  }, [applyConfig]);

  return { reports, loading, error, saveReport, renameReport, deleteReport, loadReport };
}
