'use client';

// Step 297: useCacheStatus hook
// Polls GET /api/cache/status every 30 seconds via SWR

import useSWR from 'swr';
import { cacheApi, type CacheStatusResponse } from '@/lib/cache/cacheApi';

const CACHE_STATUS_KEY = '/api/cache/status';
const POLL_INTERVAL_MS = 30_000;

async function fetchCacheStatus(): Promise<CacheStatusResponse> {
  return cacheApi.getStatus();
}

export interface UseCacheStatusResult {
  entries: CacheStatusResponse['cacheEntries'];
  total: number;
  lastChecked: string | null;
  isLoading: boolean;
  error: Error | null;
  mutate: () => void;
}

export function useCacheStatus(): UseCacheStatusResult {
  const { data, error, isLoading, mutate } = useSWR<CacheStatusResponse>(
    CACHE_STATUS_KEY,
    fetchCacheStatus,
    {
      refreshInterval: POLL_INTERVAL_MS,
      revalidateOnFocus: false,
    }
  );

  return {
    entries: data?.cacheEntries ?? [],
    total: data?.total ?? 0,
    lastChecked: data?.lastChecked ?? null,
    isLoading,
    error: error ?? null,
    mutate,
  };
}
