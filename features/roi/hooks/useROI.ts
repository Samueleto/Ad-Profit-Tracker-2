'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAuth } from 'firebase/auth';
import type {
  RoiComputeResponse,
  RoiBreakdownResponse,
  RoiBreakdownItem,
  RoiBreakdownSummary,
  RoiThresholds,
  RoiThresholdsGetResponse,
  RoiDimension,
} from '../types';

// ─── Typed error ──────────────────────────────────────────────────────────────

export class RoiApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'RoiApiError';
  }
}

// ─── Shared fetch with 401 retry ──────────────────────────────────────────────

async function authFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const auth = getAuth();

  const makeHeaders = (token?: string | null): Record<string, string> => ({
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  const doRequest = async (forceRefresh = false): Promise<Response> => {
    const token = await auth.currentUser?.getIdToken(forceRefresh);
    return fetch(path, { ...init, headers: makeHeaders(token) });
  };

  let res: Response;
  try {
    res = await doRequest();
  } catch {
    throw new RoiApiError(0, 'Check your connection and try again.');
  }

  if (res.status === 401) {
    try {
      res = await doRequest(true); // force token refresh
    } catch {
      throw new RoiApiError(401, 'Session expired. Please sign in again.');
    }
    if (res.status === 401) {
      throw new RoiApiError(401, 'Session expired. Please sign in again.');
    }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new RoiApiError(res.status, data?.error ?? data?.message ?? `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ─── In-memory client cache ───────────────────────────────────────────────────

const roiCache = new Map<string, RoiComputeResponse>();

// ─── useROIMetrics ────────────────────────────────────────────────────────────

export type RoiErrorType = 'error_401' | 'error_403' | 'error_404' | 'error_500' | null;

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
  errorType: RoiErrorType;
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
  const [errorType, setErrorType] = useState<RoiErrorType>(null);
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
    setErrorType(null);
    try {
      const params = new URLSearchParams({ dateFrom: df, dateTo: dt, groupBy: gb });
      if (nid) params.set('networkId', nid);
      const result = await authFetch<RoiComputeResponse>(`/api/roi/compute?${params}`);
      roiCache.set(cacheKey, result);
      setData(result);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const roiErr = err instanceof RoiApiError ? err : null;
      if (roiErr?.status === 401) setErrorType('error_401');
      else if (roiErr?.status === 403) setErrorType('error_403');
      else if (roiErr?.status === 404) setErrorType('error_404');
      else setErrorType('error_500');
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
    errorType,
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
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load ROI breakdown.'))
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
  isRateLimited: boolean;
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
  const [isRateLimited, setIsRateLimited] = useState(false);

  useEffect(() => {
    authFetch<RoiThresholdsGetResponse>('/api/roi/thresholds')
      .then(d => {
        const { usingDefaults: ud, ...t } = d;
        setThresholds(t);
        setUsingDefaults(ud ?? []);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load thresholds.'))
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
      if (err instanceof RoiApiError && err.status === 429) {
        setIsRateLimited(true);
        setTimeout(() => setIsRateLimited(false), 60_000);
      }
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [thresholds]);

  return { thresholds, usingDefaults, isSaving, isLoading, error, validationError, isRateLimited, updateThresholds };
}
