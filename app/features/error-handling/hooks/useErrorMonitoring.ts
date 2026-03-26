'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { getAuthHeaders } from '@/lib/auth/getAuthHeaders';

// ─── Shared fetch helper ──────────────────────────────────────────────────────

async function authFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(path, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> ?? {}) } });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Unauthorized'); }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

// ─── useCircuitBreakerStatus ──────────────────────────────────────────────────

export interface CircuitBreakerResult {
  summary: Record<string, unknown>;
  circuits: unknown[];
}

export function useCircuitBreakerStatus() {
  const [data, setData] = useState<CircuitBreakerResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetch = useCallback(async () => {
    try {
      const result = await authFetch<CircuitBreakerResult>('/api/errors/circuit-breaker/status');
      if (mountedRef.current) { setData(result); setError(null); }
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : 'Failed to load circuit breaker status.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetch();
    const id = setInterval(fetch, 30_000);
    return () => { mountedRef.current = false; clearInterval(id); };
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ─── useResetCircuitBreaker ───────────────────────────────────────────────────

export function useResetCircuitBreaker(onSuccess?: () => void) {
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(async (networkId: string) => {
    setIsResetting(true);
    setError(null);
    try {
      await authFetch('/api/errors/circuit-breaker/reset', {
        method: 'POST',
        body: JSON.stringify({ networkId }),
      });
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed.');
    } finally {
      setIsResetting(false);
    }
  }, [onSuccess]);

  return { reset, isResetting, error };
}

// ─── useRetryState ────────────────────────────────────────────────────────────

export function useRetryState(networkId?: string) {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = networkId ? `?networkId=${encodeURIComponent(networkId)}` : '';
    setLoading(true);
    authFetch(`/api/errors/retry-state${params}`)
      .then(d => { setData(d); setError(null); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [networkId]);

  return { networks: (data as { networks?: unknown[] })?.networks ?? data, loading, error };
}

// ─── useErrorLog ──────────────────────────────────────────────────────────────

export interface ErrorLogEntry {
  id: string;
  networkId?: string;
  errorCode?: string;
  message: string;
  createdAt: string;
  [key: string]: unknown;
}

export interface ErrorLogFilters {
  networkId?: string;
  errorCode?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export function useErrorLog() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const getFiltersFromUrl = useCallback((): ErrorLogFilters => ({
    networkId: searchParams.get('networkId') ?? undefined,
    errorCode: searchParams.get('errorCode') ?? undefined,
    startDate: searchParams.get('startDate') ?? undefined,
    endDate: searchParams.get('endDate') ?? undefined,
    limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
  }), [searchParams]);

  const [filters, setFiltersState] = useState<ErrorLogFilters>(getFiltersFromUrl);
  const [errors, setErrors] = useState<ErrorLogEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreTrigger, setLoadMoreTrigger] = useState(0);
  const fetchIdRef = useRef(0);

  const fetchPage = useCallback(async (f: ErrorLogFilters, currentCursor: string | null, append: boolean) => {
    const fetchId = ++fetchIdRef.current;
    if (!append) setInitialLoading(true); else setLoadingMore(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (f.networkId) params.set('networkId', f.networkId);
      if (f.errorCode) params.set('errorCode', f.errorCode);
      if (f.startDate) params.set('startDate', f.startDate);
      if (f.endDate) params.set('endDate', f.endDate);
      if (f.limit) params.set('limit', String(f.limit));
      if (currentCursor) params.set('cursor', currentCursor);
      const data = await authFetch<{ errors: ErrorLogEntry[]; hasMore: boolean; nextCursor: string | null }>(
        `/api/errors/log?${params}`
      );
      if (fetchId !== fetchIdRef.current) return;
      if (append) setErrors(prev => [...prev, ...(data.errors ?? [])]);
      else setErrors(data.errors ?? []);
      setHasMore(data.hasMore ?? !!data.nextCursor);
      setCursor(data.nextCursor ?? null);
    } catch (err) {
      if (fetchId === fetchIdRef.current) setError(err instanceof Error ? err.message : 'Failed to load errors.');
    } finally {
      if (fetchId === fetchIdRef.current) { setInitialLoading(false); setLoadingMore(false); }
    }
  }, []);

  // Sync filters to URL
  const setFilters = useCallback((newFilters: Partial<ErrorLogFilters>) => {
    setFiltersState(prev => {
      const merged = { ...prev, ...newFilters };
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(merged).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
        else params.delete(k);
      });
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      return merged;
    });
  }, [pathname, router, searchParams]);

  // Reset on filter change
  useEffect(() => {
    setErrors([]);
    setCursor(null);
    fetchPage(filters, null, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  useEffect(() => {
    if (loadMoreTrigger === 0) return;
    fetchPage(filtersRef.current, cursorRef.current, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadMoreTrigger]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    setLoadMoreTrigger(n => n + 1);
  }, [hasMore, loadingMore]);

  return { errors, hasMore, loadMore, initialLoading, loadingMore, error, filters, setFilters };
}

// ─── useErrorSummary ──────────────────────────────────────────────────────────

export function useErrorSummary(dateFrom?: string, dateTo?: string) {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    setLoading(true);
    authFetch(`/api/errors/summary?${params}`)
      .then(d => { setData(d); setError(null); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo]);

  return { data, loading, error };
}

// ─── useRetryConfig ───────────────────────────────────────────────────────────

export function useRetryConfig() {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    setLoading(true);
    authFetch('/api/errors/retry-config')
      .then(d => { setData(d); setError(null); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [refreshTick]);

  const refresh = useCallback(() => setRefreshTick(n => n + 1), []);

  return { data, loading, error, refresh };
}

// ─── useUpdateRetryConfig ─────────────────────────────────────────────────────

export function useUpdateRetryConfig(onSuccess?: () => void) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback(async (config: Record<string, unknown>) => {
    setIsSaving(true);
    setError(null);
    try {
      await authFetch('/api/errors/retry-config', {
        method: 'PATCH',
        body: JSON.stringify(config),
      });
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update retry config.');
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [onSuccess]);

  return { update, isSaving, error };
}
