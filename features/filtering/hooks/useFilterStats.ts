'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth } from 'firebase/auth';
import { toast } from 'sonner';
import { useDashboardStore } from '@/store/dashboardStore';
import { useDateRangeStore } from '@/store/dateRangeStore';
import type { FilterStatsRow, FilterStatsSummary } from '../types';

async function authFetch(url: string, signal: AbortSignal, refresh = false): Promise<Response> {
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken(refresh);
  return fetch(url, {
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

export interface UseFilterStatsResult {
  rows: FilterStatsRow[];
  summary: FilterStatsSummary | null;
  loading: boolean;
  error: string | null;
  hasActiveFilters: boolean;
}

export function useFilterStats(groupBy: 'network' | 'country' | 'daily' = 'network'): UseFilterStatsResult {
  const router = useRouter();
  const { filters } = useDashboardStore();
  const { fromDate, toDate } = useDateRangeStore();
  const [rows, setRows] = useState<FilterStatsRow[]>([]);
  const [summary, setSummary] = useState<FilterStatsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const hasActiveFilters =
    filters.selectedNetworks.length > 0 ||
    filters.selectedCountries.length > 0 ||
    filters.selectedMetric !== 'profit' ||
    filters.dataQuality !== 'all';

  const networksKey = filters.selectedNetworks.join(',');
  const countriesKey = filters.selectedCountries.join(',');

  const doFetch = useCallback(async () => {
    if (!hasActiveFilters) {
      setRows([]);
      setSummary(null);
      return;
    }
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        dateFrom: fromDate,
        dateTo: toDate,
        groupBy,
        metric: filters.selectedMetric,
        dataQuality: filters.dataQuality,
      });
      if (networksKey) params.set('networks', networksKey);
      if (countriesKey) params.set('countries', countriesKey);
      const url = `/api/filters/stats?${params}`;
      const signal = abortRef.current.signal;
      let res = await authFetch(url, signal);
      if (res.status === 401) {
        res = await authFetch(url, signal, true);
        if (res.status === 401) {
          toast.error('Session expired. Please sign in again.');
          router.replace('/');
          return;
        }
      }
      if (!res.ok) { setError('Failed to load filtered stats.'); return; }
      const data = await res.json();
      setRows(data.rows ?? []);
      setSummary(data.summary ?? null);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError('Failed to load filtered stats.');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate, groupBy, networksKey, countriesKey, filters.selectedMetric, filters.dataQuality, hasActiveFilters, router]);

  useEffect(() => {
    doFetch();
    return () => { abortRef.current?.abort(); };
  }, [doFetch]);

  return { rows, summary, loading, error, hasActiveFilters };
}
