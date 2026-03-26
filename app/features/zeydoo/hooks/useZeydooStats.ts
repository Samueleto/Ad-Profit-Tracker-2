'use client';

import useSWR from 'swr';
import { getAuth } from 'firebase/auth';

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

export function useZeydooStats(dateFrom: string, dateTo: string, groupBy: 'day' | 'total' = 'day') {
  const key = dateFrom && dateTo
    ? `/api/networks/zeydoo/stats?dateFrom=${dateFrom}&dateTo=${dateTo}&groupBy=${groupBy}`
    : null;
  const { data, error, isLoading, mutate } = useSWR(key, fetchWithToken);
  return { data, isLoading, error, refetch: mutate };
}

export function useZeydooStatsByCountry(dateFrom: string, dateTo: string, limit?: number) {
  const params = new URLSearchParams({ dateFrom, dateTo });
  if (limit) params.set('limit', String(limit));
  const key = dateFrom && dateTo
    ? `/api/networks/zeydoo/stats/by-country?${params}`
    : null;
  const { data, error, isLoading, mutate } = useSWR(key, fetchWithToken);
  return { data, isLoading, error, refetch: mutate };
}

export function useZeydooLatest() {
  const { data, error, isLoading, mutate } = useSWR('/api/networks/zeydoo/stats/latest', fetchWithToken);
  return { data, isLoading, error, refetch: mutate };
}

export function useZeydooRawResponse(date: string) {
  const key = date ? `/api/networks/zeydoo/raw-response?date=${date}` : null;
  const { data, error, isLoading, mutate } = useSWR(key, fetchWithToken);
  return { data, isLoading, error, refetch: mutate };
}
