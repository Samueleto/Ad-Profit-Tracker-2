'use client';

import { useState, useCallback } from 'react';
import { mutate } from 'swr';
import { cacheApi, CacheApiError, type CacheInvalidateOptions } from '@/lib/cache/cacheApi';

const CACHE_STATUS_KEY = '/api/cache/status';

export interface UseCacheInvalidationResult {
  invalidate: (options: CacheInvalidateOptions) => Promise<void>;
  isInvalidating: boolean;
  error: string | null;
  retryAfterSeconds: number | null;
  clearError: () => void;
}

export function useCacheInvalidation(): UseCacheInvalidationResult {
  const [isInvalidating, setIsInvalidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | null>(null);

  const invalidate = useCallback(async (options: CacheInvalidateOptions) => {
    setIsInvalidating(true);
    setError(null);
    setRetryAfterSeconds(null);
    try {
      await cacheApi.invalidate(options);
      // Refresh cache status after successful invalidation
      await mutate(CACHE_STATUS_KEY);
    } catch (err) {
      if (err instanceof CacheApiError) {
        if (err.status === 401) {
          // Session expired — redirect to re-authenticate
          window.location.href = '/';
          return;
        }
        if (err.status === 400) {
          setError('Invalid cache scope — please try again');
        } else if (err.status === 429) {
          setRetryAfterSeconds(err.retryAfterSeconds);
          const timeMsg = err.retryAfterSeconds
            ? ` Try again in ${Math.ceil(err.retryAfterSeconds / 60)} minute${err.retryAfterSeconds > 60 ? 's' : ''}.`
            : '';
          setError(`You've reached the cache invalidation limit.${timeMsg}`);
        } else if (err.status >= 500) {
          setError('Something went wrong on our end — your cache was not cleared');
        } else {
          setError(err.message);
        }
      } else {
        setError(err instanceof Error ? err.message : 'Cache invalidation failed');
      }
    } finally {
      setIsInvalidating(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setRetryAfterSeconds(null);
  }, []);

  return { invalidate, isInvalidating, error, retryAfterSeconds, clearError };
}
