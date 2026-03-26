'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAuthHeaders } from '@/lib/auth/getAuthHeaders';
import type {
  RoiComputeResponse,
  RoiBreakdownResponse,
  RoiBreakdownItem,
  RoiBreakdownSummary,
  RoiThresholds,
  RoiThresholdsGetResponse,
  RoiDimension,
} from '../types';

// ─── Shared fetch ─────────────────────────────────────────────────────────────

async function authFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let headers: Record<string, string>;
  try {
    headers = await getAuthHeaders();
  } catch {
    // Try force refresh
    const { getAuth } = await import('firebase/auth');
    const token = await getAuth().currentUser?.getIdToken(true);
    headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  }
  const res = await fetch(path, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> ?? {}) } });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

// ─── In-memory client cache ───────────────────────────────────────────────────

const roiCache = new Map<string, RoiComputeResponse>();

// ─── useROIMetrics ────────────────────────────────────────────────────────────

export interface UseROIMetricsResult {
  roi: number | null;
  roiIndicator: string | null;
  colorCode: string | null;
  roiChange: number | null;
  roiChangeDirection: string | null;
  totalRevenue: number | null;
  totalCost: number | null;
  netProfit: number | null;
  series: RoiComputeResponse['series'];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useROIMetrics(
  dateFrom: string,
  dateTo: string,
  networkId?: string,
  groupBy = 'daily'
): UseROIMetricsResult {
  const [data, setData] = useState<RoiComputeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const doFetch = useCallback(async (df: string, dt: string, nid?: string, gb = 'daily') => {
    const cacheKey = `${df}|${dt}|${nid ?? ''}|${gb}`;
    if (roiCache.has(cacheKey)) {
      setData(roiCache.get(cacheKey)!);
      setIsLoading(false);
      return;
    }
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ dateFrom: df, dateTo: dt, groupBy: gb });
      if (nid) params.set('networkId', nid);
      const result = await authFetch<RoiComputeResponse>(`/api/roi/compute?${params}`);
      roiCache.set(cacheKey, result);
      setData(result);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to load ROI metrics.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!dateFrom || !dateTo) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doFetch(dateFrom, dateTo, networkId, groupBy);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [dateFrom, dateTo, networkId, groupBy, tick, doFetch]);

  const refetch = useCallback(() => {
    // Clear cache for current params
    const cacheKey = `${dateFrom}|${dateTo}|${networkId ?? ''}|${groupBy}`;
    roiCache.delete(cacheKey);
    setTick(n => n + 1);
  }, [dateFrom, dateTo, networkId, groupBy]);

  return {
    roi: data?.roi ?? null,
    roiIndicator: data?.roiIndicator ?? null,
    colorCode: data?.colorCode ?? null,
    roiChange: data?.roiChange ?? null,
    roiChangeDirection: data?.roiChangeDirection ?? null,
    totalRevenue: data?.totalRevenue ?? null,
    totalCost: data?.totalCost ?? null,
    netProfit: data?.netProfit ?? null,
    series: data?.series,
    isLoading,
    error,
    refetch,
  };
}

// ─── useROIBreakdown ──────────────────────────────────────────────────────────

export interface UseROIBreakdownResult {
  breakdown: RoiBreakdownItem[];
  summary: RoiBreakdownSummary | null;
  isLoading: boolean;
  error: string | null;
}

export function useROIBreakdown(dateFrom: string, dateTo: string, dimension: RoiDimension): UseROIBreakdownResult {
  const [breakdown, setBreakdown] = useState<RoiBreakdownItem[]>([]);
  const [summary, setSummary] = useState<RoiBreakdownSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dateFrom || !dateTo) return;
    setIsLoading(true);
    setError(null);
    authFetch<RoiBreakdownResponse>(`/api/roi/breakdown?dateFrom=${dateFrom}&dateTo=${dateTo}&dimension=${dimension}`)
      .then(d => { setBreakdown(d.breakdown ?? []); setSummary(d.summary ?? null); })
      .catch(err => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [dateFrom, dateTo, dimension]);

  return { breakdown, summary, isLoading, error };
}

// ─── useROIThresholds ─────────────────────────────────────────────────────────

export interface UseROIThresholdsResult {
  thresholds: RoiThresholds | null;
  usingDefaults: string[];
  isSaving: boolean;
  isLoading: boolean;
  error: string | null;
  validationError: string | null;
  updateThresholds: (patch: Partial<RoiThresholds>) => Promise<void>;
}

function validateThresholdOrder(t: RoiThresholds): string | null {
  if (t.criticalThreshold > t.warningThreshold) {
    return 'Critical threshold must be ≤ warning threshold.';
  }
  if (t.warningThreshold > t.positiveThreshold) {
    return 'Warning threshold must be ≤ positive threshold.';
  }
  return null;
}

export function useROIThresholds(): UseROIThresholdsResult {
  const [thresholds, setThresholds] = useState<RoiThresholds | null>(null);
  const [usingDefaults, setUsingDefaults] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    authFetch<RoiThresholdsGetResponse>('/api/roi/thresholds')
      .then(d => {
        const { usingDefaults: ud, ...t } = d;
        setThresholds(t);
        setUsingDefaults(ud ?? []);
      })
      .catch(err => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  const updateThresholds = useCallback(async (patch: Partial<RoiThresholds>) => {
    if (!thresholds) return;
    const merged: RoiThresholds = { ...thresholds, ...patch };
    const vErr = validateThresholdOrder(merged);
    if (vErr) { setValidationError(vErr); return; }
    setValidationError(null);
    const previous = thresholds;
    setThresholds(merged); // optimistic
    setIsSaving(true);
    try {
      const result = await authFetch<RoiThresholds>('/api/roi/thresholds', {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setThresholds(result);
    } catch (err) {
      setThresholds(previous); // rollback
      setError(err instanceof Error ? err.message : 'Failed to save thresholds.');
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [thresholds]);

  return { thresholds, usingDefaults, isSaving, isLoading, error, validationError, updateThresholds };
}
