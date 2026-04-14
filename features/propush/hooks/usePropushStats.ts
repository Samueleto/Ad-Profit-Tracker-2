'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
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

// ─── usePropushLatest ─────────────────────────────────────────────────────────

export function usePropushLatest() {
  const key = `/api/networks/propush/stats/latest`;
  const { data, error, isLoading, mutate } = useCachedNetworkData('propush', key, fetchWithToken);
  return { data, isLoading, error, refetch: mutate };
}

// ─── usePropushStats ──────────────────────────────────────────────────────────

export function usePropushStats(dateFrom: string, dateTo: string, groupBy: 'day' | 'total' = 'day') {
  const key = dateFrom && dateTo
    ? `/api/networks/propush/stats?dateFrom=${dateFrom}&dateTo=${dateTo}&groupBy=${groupBy}`
    : null;
  const { data, error, isLoading, mutate } = useSWR(key, fetchWithToken, { keepPreviousData: true });
  return { data, isLoading, error, refetch: mutate };
}

// ─── usePropushRawResponse (lazy — does not fetch on mount) ───────────────────

export function usePropushRawResponse() {
  const router = useRouter();
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
    const url = `/api/networks/propush/raw-response?date=${date}`;
    const doFetch = async (refresh: boolean) => {
      const token = await getAuth().currentUser?.getIdToken(refresh);
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      return fetch(url, { headers, signal: abortRef.current!.signal });
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
  }, [router]);

  return { fetch: fetchData, data, schema, isLoading, error };
}
