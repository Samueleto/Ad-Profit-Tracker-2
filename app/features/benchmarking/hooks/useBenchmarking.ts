'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { authFetch as sharedAuthFetch, clampDateRange } from '@/lib/api/auth-fetch';
import type {
  MetricKey,
  BenchmarkPerformanceResponse,
  BenchmarkSettingsResponse,
  BenchmarkSettingsMetric,
  BenchmarkSettingsPatchBody,
} from '../types';

// ─── Shared fetch ─────────────────────────────────────────────────────────────

async function authFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  // Uses shared utility: getIdToken(false) → retry with getIdToken(true) on 401
  // → redirect to / with 'Session expired' toast if retry also fails
  const res = await sharedAuthFetch(path, init);
  if (res === null) throw new Error('Session expired');
  if (res.status === 429) {
    const retryAfter = res.headers.get('Retry-After');
    throw new Error(
      `Too many updates, please wait${retryAfter ? ` (retry after ${retryAfter}s)` : ''} before saving again.`
    );
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error ?? data?.message ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

// ─── useBenchmarkingData ──────────────────────────────────────────────────────

export interface UseUseBenchmarkingDataResult {
  selectedMetric: MetricKey;
  setSelectedMetric: (m: MetricKey) => void;
  comparisonData: unknown;
  performanceData: BenchmarkPerformanceResponse | null;
  scoreData: unknown;
  comparisonLoading: boolean;
  performanceLoading: boolean;
  scoreLoading: boolean;
  comparisonError: string | null;
  performanceError: string | null;
  scoreError: string | null;
  hasLoaded: boolean;
  networkStatus: Record<string, unknown>;
}

export function useBenchmarkingData(dateFrom: string, dateTo: string, enabled = true): UseUseBenchmarkingDataResult {
  const [selectedMetric, setSelectedMetricState] = useState<MetricKey>('roi');
  const [comparisonData, setComparisonData] = useState<unknown>(null);
  const [performanceData, setPerformanceData] = useState<BenchmarkPerformanceResponse | null>(null);
  const [scoreData, setScoreData] = useState<unknown>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [performanceError, setPerformanceError] = useState<string | null>(null);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<Record<string, unknown>>({});
  const metricFetchIdRef = useRef(0);

  // Fetch comparison + score on date range change (when enabled)
  useEffect(() => {
    if (!enabled || !dateFrom || !dateTo) return;
    const params = new URLSearchParams({ dateFrom, dateTo });

    setComparisonLoading(true);
    setScoreLoading(true);

    const comparisonFetch = authFetch<Record<string, unknown>>(`/api/networks/comparison?${params}`)
      .then(d => {
        setComparisonData(d);
        // Extract per-network status
        const networks = (d?.networks as Record<string, unknown>[] ?? []);
        const statusMap: Record<string, unknown> = {};
        for (const n of networks) {
          const id = n.networkId as string;
          if (id) statusMap[id] = { lastSyncStatus: n.lastSyncStatus, circuitBreakerOpen: n.circuitBreakerOpen };
        }
        setNetworkStatus(statusMap);
        setComparisonError(null);
      })
      .catch(err => setComparisonError(err.message))
      .finally(() => setComparisonLoading(false));

    const scoreFetch = authFetch(`/api/benchmarks/score?${params}`)
      .then(d => { setScoreData(d); setScoreError(null); })
      .catch(err => setScoreError(err.message))
      .finally(() => setScoreLoading(false));

    Promise.all([comparisonFetch, scoreFetch]).then(() => setHasLoaded(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, dateFrom, dateTo]);

  // Fetch performance data on metric or date range change
  useEffect(() => {
    if (!enabled || !dateFrom || !dateTo) return;
    const fetchId = ++metricFetchIdRef.current;
    // Clamp date range to 90 days client-side (server still validates independently)
    const { dateFrom: clampedFrom, dateTo: clampedTo } = clampDateRange(dateFrom, dateTo);
    const params = new URLSearchParams({ dateFrom: clampedFrom, dateTo: clampedTo, metric: selectedMetric });
    setPerformanceLoading(true);
    authFetch<BenchmarkPerformanceResponse>(`/api/benchmarks/performance?${params}`)
      .then(d => { if (fetchId === metricFetchIdRef.current) { setPerformanceData(d); setPerformanceError(null); } })
      .catch(err => { if (fetchId === metricFetchIdRef.current) setPerformanceError(err.message); })
      .finally(() => { if (fetchId === metricFetchIdRef.current) setPerformanceLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, dateFrom, dateTo, selectedMetric]);

  const setSelectedMetric = useCallback((m: MetricKey) => setSelectedMetricState(m), []);

  return {
    selectedMetric, setSelectedMetric,
    comparisonData, performanceData, scoreData,
    comparisonLoading, performanceLoading, scoreLoading,
    comparisonError, performanceError, scoreError,
    hasLoaded, networkStatus,
  };
}

// ─── useBenchmarkSettings ─────────────────────────────────────────────────────

type FormTargets = Record<MetricKey, { customTarget: number | null; useDefault: boolean }>;
type ValidationErrors = Partial<Record<MetricKey, string>>;

export interface UseBenchmarkSettingsResult {
  savedSettings: BenchmarkSettingsResponse | null;
  formTargets: FormTargets | null;
  isDirty: boolean;
  validationErrors: ValidationErrors;
  loading: boolean;
  saving: boolean;
  error: string | null;
  lastUpdatedAt: unknown;
  updateField: (metric: MetricKey, field: 'customTarget' | 'useDefault', value: number | boolean | null) => void;
  resetMetric: (metric: MetricKey) => void;
  resetAll: () => void;
  submit: () => Promise<void>;
  cancel: () => void;
  loadSettings: () => void;
}

function validateTarget(metric: MetricKey, value: number | null): string | null {
  if (value === null) return null;
  if (value < 0) return `${metric} target cannot be negative.`;
  return null;
}

function buildFormTargets(settings: BenchmarkSettingsResponse): FormTargets {
  return Object.fromEntries(
    settings.metricTargets.map(m => [m.metric, { customTarget: m.customTarget, useDefault: m.useDefault }])
  ) as FormTargets;
}

export function useBenchmarkSettings(): UseBenchmarkSettingsResult {
  const [savedSettings, setSavedSettings] = useState<BenchmarkSettingsResponse | null>(null);
  const [formTargets, setFormTargets] = useState<FormTargets | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [tick, setTick] = useState(0);

  const loadSettings = useCallback(() => setTick(n => n + 1), []);

  useEffect(() => {
    if (tick === 0 && savedSettings) return; // only load once unless explicitly called
    setLoading(true);
    authFetch<BenchmarkSettingsResponse>('/api/benchmarks/settings')
      .then(d => {
        setSavedSettings(d);
        setFormTargets(buildFormTargets(d));
        setError(null);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const isDirty = formTargets !== null && savedSettings !== null && (
    JSON.stringify(formTargets) !== JSON.stringify(buildFormTargets(savedSettings))
  );

  const validate = useCallback((targets: FormTargets): ValidationErrors => {
    const errs: ValidationErrors = {};
    for (const [k, v] of Object.entries(targets) as [MetricKey, { customTarget: number | null }][]) {
      const err = validateTarget(k, v.customTarget);
      if (err) errs[k] = err;
    }
    return errs;
  }, []);

  const updateField = useCallback((metric: MetricKey, field: 'customTarget' | 'useDefault', value: number | boolean | null) => {
    setFormTargets(prev => {
      if (!prev) return prev;
      const next = { ...prev, [metric]: { ...prev[metric], [field]: value } };
      setValidationErrors(validate(next));
      return next;
    });
  }, [validate]);

  const resetMetric = useCallback((metric: MetricKey) => {
    if (!savedSettings) return;
    const saved = savedSettings.metricTargets.find(m => m.metric === metric);
    if (!saved) return;
    setFormTargets(prev => prev ? { ...prev, [metric]: { customTarget: saved.customTarget, useDefault: saved.useDefault } } : prev);
    setValidationErrors(prev => { const n = { ...prev }; delete n[metric]; return n; });
  }, [savedSettings]);

  const resetAll = useCallback(() => {
    if (!savedSettings) return;
    setFormTargets(buildFormTargets(savedSettings));
    setValidationErrors({});
  }, [savedSettings]);

  const submit = useCallback(async () => {
    if (!formTargets || !savedSettings) return;
    const errs = validate(formTargets);
    setValidationErrors(errs);
    if (Object.keys(errs).length) return;

    // Only send changed fields
    const savedMap = buildFormTargets(savedSettings);
    const changed: BenchmarkSettingsPatchBody['metricTargets'] = {};
    for (const [k, v] of Object.entries(formTargets) as [MetricKey, FormTargets[MetricKey]][]) {
      if (JSON.stringify(v) !== JSON.stringify(savedMap[k])) {
        changed[k] = v;
      }
    }
    if (!Object.keys(changed).length) return;

    setSaving(true);
    try {
      const updated = await authFetch<BenchmarkSettingsResponse>('/api/benchmarks/settings', {
        method: 'PATCH',
        body: JSON.stringify({ metricTargets: changed }),
      });
      setSavedSettings(updated);
      setFormTargets(buildFormTargets(updated));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings.');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [formTargets, savedSettings, validate]);

  const cancel = useCallback(() => {
    if (!savedSettings) return;
    setFormTargets(buildFormTargets(savedSettings));
    setValidationErrors({});
  }, [savedSettings]);

  return {
    savedSettings, formTargets, isDirty, validationErrors,
    loading, saving, error,
    lastUpdatedAt: savedSettings?.lastUpdatedAt ?? null,
    updateField, resetMetric, resetAll, submit, cancel, loadSettings,
  };
}
