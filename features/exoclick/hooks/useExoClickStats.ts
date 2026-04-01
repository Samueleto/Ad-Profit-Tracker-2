'use client';

import { useState, useEffect, useCallback } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { getAuth } from 'firebase/auth';
import { useCachedNetworkData } from '@/features/caching/hooks/useNetworkCacheConfig';

// ─── Shared fetcher ───────────────────────────────────────────────────────────

async function fetchWithToken(url: string) {
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const err = new Error(`Request failed: ${res.status}`);
    (err as Error & { status: number }).status = res.status;
    throw err;
  }
  return res.json();
}

// ─── Debounce helper ──────────────────────────────────────────────────────────

function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// ─── useExoClickLatest ────────────────────────────────────────────────────────
// Uses useCachedNetworkData so SWR config is driven by per-network cache settings

export function useExoClickLatest() {
  const key = `/api/networks/exoclick/stats/latest`;
  const { data, error, isLoading, mutate } = useCachedNetworkData('exoclick', key, fetchWithToken);
  return { data, isLoading, error, refetch: mutate };
}

// ─── useExoClickStats ─────────────────────────────────────────────────────────

export function useExoClickStats(dateFrom: string, dateTo: string, groupBy: 'day' | 'total' = 'day') {
  const debouncedFrom = useDebouncedValue(dateFrom);
  const debouncedTo = useDebouncedValue(dateTo);
  const debouncedGroupBy = useDebouncedValue(groupBy);
  const key = `/api/networks/exoclick/stats?from=${debouncedFrom}&to=${debouncedTo}&groupBy=${debouncedGroupBy}`;
  const { data, error, isLoading, mutate } = useSWR(key, fetchWithToken, { keepPreviousData: true });
  return { data, isLoading, error, refetch: mutate };
}

// ─── useExoClickCountries (and alias useExoClickStatsByCountry) ───────────────

export function useExoClickCountries(dateFrom: string, dateTo: string, limit?: number) {
  const debouncedFrom = useDebouncedValue(dateFrom);
  const debouncedTo = useDebouncedValue(dateTo);
  const debouncedLimit = useDebouncedValue(limit);
  const params = new URLSearchParams({ from: debouncedFrom, to: debouncedTo });
  if (debouncedLimit) params.set('limit', String(debouncedLimit));
  const key = `/api/networks/exoclick/stats/by-country?${params}`;
  const { data, error, isLoading, mutate } = useSWR(key, fetchWithToken, { keepPreviousData: true });
  return {
    countries: data?.countries ?? data ?? [],
    totalCost: data?.totalCost ?? null,
    isLoading,
    error,
    refetch: mutate,
  };
}

/** @deprecated Use useExoClickCountries */
export function useExoClickStatsByCountry(dateFrom: string, dateTo: string, limit?: number) {
  return useExoClickCountries(dateFrom, dateTo, limit);
}

// ─── useExoClickSync ──────────────────────────────────────────────────────────

export function useExoClickSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { mutate } = useSWRConfig();

  const triggerSync = useCallback(async (dateFrom: string, dateTo: string) => {
    setIsSyncing(true);
    setError(null);
    try {
      const token = await getAuth().currentUser?.getIdToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch('/api/networks/exoclick/sync', {
        method: 'POST',
        headers,
        body: JSON.stringify({ dateFrom, dateTo }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? `Sync failed: ${res.status}`);
      }
      const result = await res.json();
      setLastResult(result);
      // Invalidate latest stats so summary card refreshes
      await mutate('/api/networks/exoclick/stats/latest');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed.');
    } finally {
      setIsSyncing(false);
    }
  }, [mutate]);

  return { triggerSync, isSyncing, lastResult, error };
}

// ─── useExoClickRawResponse ───────────────────────────────────────────────────

export function useExoClickRawResponse(date: string) {
  const debouncedDate = useDebouncedValue(date);
  const key = debouncedDate ? `/api/networks/exoclick/raw-response?date=${debouncedDate}` : null;
  const { data, error, isLoading, mutate } = useSWR(key, fetchWithToken);
  return {
    records: data?.records ?? data ?? [],
    fieldSchema: data?.fieldSchema ?? null,
    isLoading,
    error,
    refetch: mutate,
  };
}
