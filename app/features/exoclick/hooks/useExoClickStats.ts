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

export function useExoClickStats(dateFrom: string, dateTo: string, groupBy: 'day' | 'total' = 'day') {
  const key = `/api/networks/exoclick/stats?from=${dateFrom}&to=${dateTo}&groupBy=${groupBy}`;
  const { data, error, isLoading, mutate } = useSWR(key, fetchWithToken);
  return { data, isLoading, error, refetch: mutate };
}

export function useExoClickStatsByCountry(dateFrom: string, dateTo: string, limit?: number) {
  const params = new URLSearchParams({ from: dateFrom, to: dateTo });
  if (limit) params.set('limit', String(limit));
  const key = `/api/networks/exoclick/stats/by-country?${params}`;
  const { data, error, isLoading, mutate } = useSWR(key, fetchWithToken);
  return { data, isLoading, error, refetch: mutate };
}

export function useExoClickLatest() {
  const key = `/api/networks/exoclick/stats/latest`;
  const { data, error, isLoading, mutate } = useSWR(key, fetchWithToken);
  return { data, isLoading, error, refetch: mutate };
}

export function useExoClickRawResponse(date: string) {
  const key = date ? `/api/networks/exoclick/raw-response?date=${date}` : null;
  const { data, error, isLoading, mutate } = useSWR(key, fetchWithToken);
  return { data, isLoading, error, refetch: mutate };
}
