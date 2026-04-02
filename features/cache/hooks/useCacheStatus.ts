'use client';

import useSWR from 'swr';
import { cacheApi, type CacheStatusResponse } from '@/lib/cache/cacheApi';

const CACHE_STATUS_KEY = '/api/cache/status';
const POLL_INTERVAL_MS = 30_000;
const MAX_BACKOFF_MS = 5 * 60 * 1000; // 5 minutes

async function fetchCacheStatus(): Promise<CacheStatusResponse> {
  return cacheApi.getStatus();
}

export interface UseCacheStatusResult {
  entries: CacheStatusResponse['cacheEntries'];
  total: number;
  lastChecked: string | null;
  isLoading: boolean;
  error: string | null;
  mutate: () => void;
}

export function useCacheStatus(): UseCacheStatusResult {
  const { data, error, isLoading, mutate } = useSWR<CacheStatusResponse>(
    CACHE_STATUS_KEY,
    fetchCacheStatus,
    {
      refreshInterval: POLL_INTERVAL_MS,
      revalidateOnFocus: false,
      // Exponential backoff: double the wait time on each retry, capped at 5 minutes
      onErrorRetry: (_error, _key, _config, revalidate, { retryCount }) => {
        const delay = Math.min(POLL_INTERVAL_MS * Math.pow(2, retryCount), MAX_BACKOFF_MS);
        setTimeout(() => revalidate({ retryCount }), delay);
      },
    }
  );

  const errorMessage = error != null ? 'Cache stats temporarily unavailable' : null;

  return {
    entries: data?.cacheEntries ?? [],
    total: data?.total ?? 0,
    lastChecked: data?.lastChecked ?? null,
    isLoading,
    error: errorMessage,
    mutate,
  };
}
