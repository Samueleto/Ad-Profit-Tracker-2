'use client';

import { useState, useCallback, useRef } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { getAuth } from 'firebase/auth';

// ─── Error types ──────────────────────────────────────────────────────────────

export type ZeydooErrorType = 'auth' | 'bad_request' | 'server_error' | 'network' | null;

interface FetchError extends Error {
  status?: number;
  errorType?: ZeydooErrorType;
}

// ─── Shared fetcher ───────────────────────────────────────────────────────────

async function fetchWithToken(url: string): Promise<unknown> {
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken();
  let res: Response;
  try {
    res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    const err: FetchError = new Error('Network error');
    err.errorType = 'network';
    throw err;
  }
  if (!res.ok) {
    const err: FetchError = new Error(`Request failed: ${res.status}`);
    err.status = res.status;
    if (res.status === 401) err.errorType = 'auth';
    else if (res.status >= 400 && res.status < 500) err.errorType = 'bad_request';
    else err.errorType = 'server_error';
    throw err;
  }
  return res.json();
}

/** Fetcher that returns null on 404 instead of throwing */
async function fetchNullOn404(url: string): Promise<unknown> {
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken();
  let res: Response;
  try {
    res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    const err: FetchError = new Error('Network error');
    err.errorType = 'network';
    throw err;
  }
  if (res.status === 404) return null;
  if (!res.ok) {
    const err: FetchError = new Error(`Request failed: ${res.status}`);
    err.status = res.status;
    if (res.status === 401) err.errorType = 'auth';
    else if (res.status >= 400 && res.status < 500) err.errorType = 'bad_request';
    else err.errorType = 'server_error';
    throw err;
  }
  return res.json();
}

// ─── useZeydooLatest ──────────────────────────────────────────────────────────

export function useZeydooLatest() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/networks/zeydoo/stats/latest',
    fetchNullOn404
  );
  return { data: data ?? null, isLoading, error: error ?? null, refetch: mutate };
}

// ─── useZeydooStats ───────────────────────────────────────────────────────────

export function useZeydooStats(dateFrom: string, dateTo: string, groupBy: 'day' | 'total' = 'day', syncVersion = 0) {
  const key = dateFrom && dateTo
    ? `/api/networks/zeydoo/stats?dateFrom=${dateFrom}&dateTo=${dateTo}&groupBy=${groupBy}&_v=${syncVersion}`
    : null;
  const { data, error, isLoading, mutate } = useSWR(key, fetchWithToken, { keepPreviousData: true });
  return { data, isLoading, error: error ?? null, refetch: mutate };
}

// ─── useZeydooTopCountries ────────────────────────────────────────────────────

export function useZeydooTopCountries(dateFrom: string, dateTo: string, limit?: number, syncVersion = 0) {
  const params = new URLSearchParams({ dateFrom, dateTo });
  if (limit) params.set('limit', String(limit));
  params.set('_v', String(syncVersion));
  const key = dateFrom && dateTo ? `/api/networks/zeydoo/stats/by-country?${params}` : null;
  const { data, error, isLoading } = useSWR(key, fetchWithToken, { keepPreviousData: true });
  return {
    countries: (data as Record<string, unknown> & { countries?: unknown[] })?.countries ?? [],
    totalRevenue: (data as Record<string, unknown> & { totalRevenue?: number })?.totalRevenue ?? null,
    isLoading,
    error: error ?? null,
  };
}

/** @deprecated Use useZeydooTopCountries */
export function useZeydooStatsByCountry(dateFrom: string, dateTo: string, limit?: number) {
  return useZeydooTopCountries(dateFrom, dateTo, limit);
}

// ─── useZeydooSync ────────────────────────────────────────────────────────────

export function useZeydooSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncVersion, setSyncVersion] = useState(0);
  const { mutate } = useSWRConfig();

  const triggerSync = useCallback(async (dateFrom?: string, dateTo?: string) => {
    setIsSyncing(true);
    setError(null);
    try {
      const token = await getAuth().currentUser?.getIdToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const body: Record<string, string> = {};
      if (dateFrom) body.dateFrom = dateFrom;
      if (dateTo) body.dateTo = dateTo;
      const res = await fetch('/api/networks/zeydoo/sync', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? `Sync failed: ${res.status}`);
      }
      const result = await res.json();
      setLastSyncResult(result);
      setSyncVersion(v => v + 1);
      // Also invalidate latest
      await mutate('/api/networks/zeydoo/stats/latest');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed.');
    } finally {
      setIsSyncing(false);
    }
  }, [mutate]);

  return { triggerSync, isSyncing, lastSyncResult, error, syncVersion };
}

// ─── useZeydooRawResponse (lazy — does not fetch on mount) ────────────────────

export function useZeydooRawResponse() {
  const [data, setData] = useState<unknown>(null);
  const [schema, setSchema] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (date: string) => {
    if (!date) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setIsLoading(true);
    setError(null);
    try {
      const token = await getAuth().currentUser?.getIdToken();
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`/api/networks/zeydoo/raw-response?date=${date}`, {
        headers,
        signal: abortRef.current.signal,
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const json = await res.json();
      setData(json?.records ?? json);
      setSchema(json?.fieldSchema ?? null);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to load raw response.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { fetch: fetchData, data, schema, isLoading, error };
}
