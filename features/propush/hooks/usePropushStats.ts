'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import useSWR from 'swr';
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

// ─── usePropushLatest ─────────────────────────────────────────────────────────

export function usePropushLatest() {
  const key = `/api/networks/propush/stats/latest`;
  const { data, error, isLoading, mutate } = useCachedNetworkData('propush', key, fetchWithToken);
  return { data, isLoading, error, refetch: mutate };
}

// ─── usePropushStats ──────────────────────────────────────────────────────────

export function usePropushStats(dateFrom: string, dateTo: string, groupBy: 'day' | 'total' = 'day') {
  const key = dateFrom && dateTo
    ? `/api/networks/propush/stats?from=${dateFrom}&to=${dateTo}&groupBy=${groupBy}`
    : null;
  const { data, error, isLoading, mutate } = useSWR(key, fetchWithToken, { keepPreviousData: true });
  return { data, isLoading, error, refetch: mutate };
}

// ─── usePropushRawResponse (lazy — does not fetch on mount) ───────────────────

export function usePropushRawResponse() {
  const [data, setData] = useState<unknown>(null);
  const [schema, setSchema] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<(Error & { status?: number }) | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (date: string) => {
    if (!date) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setIsLoading(true);
    setError(null);
    setData(null);
    try {
      const token = await getAuth().currentUser?.getIdToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`/api/networks/propush/raw-response?date=${date}`, {
        headers,
        signal: abortRef.current.signal,
      });
      if (!res.ok) {
        const err = new Error(`Request failed: ${res.status}`) as Error & { status?: number };
        err.status = res.status;
        throw err;
      }
      const json = await res.json();
      setData(json?.records ?? json);
      setSchema(json?.fieldSchema ?? null);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err as Error & { status?: number });
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { fetch: fetchData, data, schema, isLoading, error };
}
