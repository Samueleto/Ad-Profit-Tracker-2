'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import useSWR, { useSWRConfig } from 'swr';
import { getAuth } from 'firebase/auth';
import { toast } from 'sonner';
import { useCachedNetworkData } from '@/features/caching/hooks/useNetworkCacheConfig';

// ─── Shared fetcher ───────────────────────────────────────────────────────────

async function fetchWithToken(url: string) {
  const auth = getAuth();
  const doFetch = async (refresh: boolean) => {
    const token = await auth.currentUser?.getIdToken(refresh);
    return fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  };
  let res = await doFetch(false);
  if (res.status === 401) {
    res = await doFetch(true);
    if (res.status === 401) {
      const err = new Error('Session expired') as Error & { status: number };
      err.status = 401;
      throw err;
    }
  }
  if (!res.ok) {
    const err = new Error(`Request failed: ${res.status}`) as Error & { status: number };
    err.status = res.status;
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

// ─── useRollerAdsLatest ───────────────────────────────────────────────────────

export function useRollerAdsLatest() {
  const key = `/api/networks/rollerads/stats/latest`;
  const { data, error, isLoading, mutate } = useCachedNetworkData('rollerads', key, fetchWithToken);
  return { data, isLoading, error, refetch: mutate };
}

// ─── useRollerAdsStats ────────────────────────────────────────────────────────

export function useRollerAdsStats(dateFrom: string, dateTo: string, groupBy: 'day' | 'total' = 'day') {
  const debouncedFrom = useDebouncedValue(dateFrom);
  const debouncedTo = useDebouncedValue(dateTo);
  const debouncedGroupBy = useDebouncedValue(groupBy);
  const key = `/api/networks/rollerads/stats?from=${debouncedFrom}&to=${debouncedTo}&groupBy=${debouncedGroupBy}`;
  const { data, error, isLoading, mutate } = useSWR(key, fetchWithToken, { keepPreviousData: true });
  return { data, isLoading, error, refetch: mutate };
}

// ─── useRollerAdsCountries ────────────────────────────────────────────────────

export function useRollerAdsCountries(dateFrom: string, dateTo: string, limit?: number) {
  const debouncedFrom = useDebouncedValue(dateFrom);
  const debouncedTo = useDebouncedValue(dateTo);
  const debouncedLimit = useDebouncedValue(limit);
  const params = new URLSearchParams({ from: debouncedFrom, to: debouncedTo });
  if (debouncedLimit) params.set('limit', String(debouncedLimit));
  const key = `/api/networks/rollerads/stats/by-country?${params}`;
  const { data, error, isLoading, mutate } = useSWR(key, fetchWithToken, { keepPreviousData: true });
  return {
    countries: data?.countries ?? data ?? [],
    totalRevenue: data?.totalRevenue ?? null,
    isLoading,
    error,
    refetch: mutate,
  };
}

// ─── useRollerAdsSync ─────────────────────────────────────────────────────────

export function useRollerAdsSync() {
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { mutate } = useSWRConfig();

  const triggerSync = useCallback(async (dateFrom: string, dateTo: string) => {
    setIsSyncing(true);
    setError(null);
    const syncBody = JSON.stringify({ dateFrom, dateTo });
    const doFetch = async (refresh: boolean) => {
      const token = await getAuth().currentUser?.getIdToken(refresh);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      return fetch('/api/networks/rollerads/sync', { method: 'POST', headers, body: syncBody });
    };
    try {
      let res = await doFetch(false);
      if (res.status === 401) {
        res = await doFetch(true);
        if (res.status === 401) {
          toast.error('Session expired. Please sign in again.');
          router.replace('/');
          return;
        }
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? `Sync failed: ${res.status}`);
      }
      const result = await res.json();
      setLastResult(result);
      await mutate('/api/networks/rollerads/stats/latest');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed.');
    } finally {
      setIsSyncing(false);
    }
  }, [mutate, router]);

  return { triggerSync, isSyncing, lastResult, error };
}

// ─── useRollerAdsRawResponse ──────────────────────────────────────────────────

export function useRollerAdsRawResponse(date: string) {
  const debouncedDate = useDebouncedValue(date);
  const key = debouncedDate ? `/api/networks/rollerads/raw-response?date=${debouncedDate}` : null;
  const { data, error, isLoading, mutate } = useSWR(key, fetchWithToken);
  return {
    records: data?.records ?? data ?? [],
    fieldSchema: data?.fieldSchema ?? null,
    isLoading,
    error,
    refetch: mutate,
  };
}
