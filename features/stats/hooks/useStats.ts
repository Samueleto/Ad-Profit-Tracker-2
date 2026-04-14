'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import { toast } from 'sonner';

// ─── Shared fetch helper ──────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
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

// ─── useSnapshot ──────────────────────────────────────────────────────────────

export function useSnapshot(date: string, networkId?: string, groupBy?: 'country' | 'total') {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!date) return;
    const params = new URLSearchParams({ date });
    if (networkId) params.set('networkId', networkId);
    if (groupBy) params.set('groupBy', groupBy);
    setLoading(true);
    setError(null);
    apiFetch(`/api/stats/snapshot?${params}`)
      .then(d => setData(d))
      .catch(err => setError(err.message ?? 'Failed to load snapshot.'))
      .finally(() => setLoading(false));
  }, [date, networkId, groupBy]);

  return { data, loading, error };
}

// ─── useTrend ─────────────────────────────────────────────────────────────────

export function useTrend(dateFrom: string, dateTo: string, networkId?: string, metric?: string) {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = dateFrom && dateTo && dateFrom <= dateTo;
  useEffect(() => {
    if (!valid) return;
    const params = new URLSearchParams({ dateFrom, dateTo });
    if (networkId) params.set('networkId', networkId);
    if (metric) params.set('metric', metric);
    setLoading(true);
    setError(null);
    apiFetch(`/api/stats/trend?${params}`)
      .then(d => setData(d))
      .catch(err => setError(err.message ?? 'Failed to load trend.'))
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo, networkId, metric, valid]);

  return { data, loading, error };
}

// ─── useSummary ───────────────────────────────────────────────────────────────

export function useSummary(dateFrom: string, dateTo: string) {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dateFrom || !dateTo) return;
    const params = new URLSearchParams({ dateFrom, dateTo });
    setLoading(true);
    setError(null);
    apiFetch(`/api/stats/summary?${params}`)
      .then(d => setData(d))
      .catch(err => setError(err.message ?? 'Failed to load summary.'))
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo]);

  return { data, loading, error };
}

// ─── useGeoBreakdown ──────────────────────────────────────────────────────────

export function useGeoBreakdown(dateFrom: string, dateTo: string, networkId?: string, metric?: string, limit?: number) {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dateFrom || !dateTo) return;
    const params = new URLSearchParams({ dateFrom, dateTo });
    if (networkId) params.set('networkId', networkId);
    if (metric) params.set('metric', metric);
    if (limit) params.set('limit', String(limit));
    setLoading(true);
    setError(null);
    apiFetch(`/api/stats/geo-breakdown?${params}`)
      .then(d => setData(d))
      .catch(err => setError(err.message ?? 'Failed to load geo breakdown.'))
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo, networkId, metric, limit]);

  return { data, loading, error };
}

// ─── useCoverage ──────────────────────────────────────────────────────────────

export function useCoverage(dateFrom: string, dateTo: string, networkId?: string) {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dateFrom || !dateTo) return;
    const params = new URLSearchParams({ dateFrom, dateTo });
    if (networkId) params.set('networkId', networkId);
    setLoading(true);
    setError(null);
    apiFetch(`/api/stats/coverage?${params}`)
      .then(d => setData(d))
      .catch(err => setError(err.message ?? 'Failed to load coverage.'))
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo, networkId]);

  return { data, loading, error };
}

// ─── useDates ─────────────────────────────────────────────────────────────────

export function useDates(networkId?: string, dateFrom?: string, dateTo?: string) {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (networkId) params.set('networkId', networkId);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    const qs = params.toString();
    setLoading(true);
    setError(null);
    apiFetch(`/api/stats/dates${qs ? `?${qs}` : ''}`)
      .then(d => setData(d))
      .catch(err => setError(err.message ?? 'Failed to load dates.'))
      .finally(() => setLoading(false));
  }, [networkId, dateFrom, dateTo]);

  return { data, loading, error };
}

// ─── useBackfill ──────────────────────────────────────────────────────────────

export interface BackfillResult {
  triggered: string[];
  skipped: string[];
  failed: string[];
}

export function useBackfill() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BackfillResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trigger = useCallback(async (dateFrom: string, dateTo: string, networkId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<BackfillResult>('/api/stats/backfill', {
        method: 'POST',
        body: JSON.stringify({ dateFrom, dateTo, ...(networkId ? { networkId } : {}) }),
      });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Backfill failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return { trigger, data, loading, error, reset };
}

// ─── useDeleteSnapshot ────────────────────────────────────────────────────────

export function useDeleteSnapshot() {
  const [loading, setLoading] = useState(false);
  const [deletedCount, setDeletedCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trigger = useCallback(async (date: string, networkId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ date });
      if (networkId) params.set('networkId', networkId);
      const result = await apiFetch<{ deletedCount: number }>(`/api/stats/snapshot?${params}`, { method: 'DELETE' });
      setDeletedCount(result.deletedCount ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setDeletedCount(null);
    setError(null);
  }, []);

  return { trigger, deletedCount, loading, error, reset };
}
