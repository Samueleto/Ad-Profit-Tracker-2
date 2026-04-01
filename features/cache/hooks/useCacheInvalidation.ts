'use client';

// Step 297: useCacheInvalidation hook
// Wraps POST /api/cache/clear (invalidate) with loading state and rate limit handling

import { useState, useCallback } from 'react';
import { mutate } from 'swr';
import { cacheApi, type CacheInvalidateOptions } from '@/lib/cache/cacheApi';

const CACHE_STATUS_KEY = '/api/cache/status';

export interface UseCacheInvalidationResult {
  invalidate: (options: CacheInvalidateOptions) => Promise<void>;
  isInvalidating: boolean;
  error: string | null;
  clearError: () => void;
}

export function useCacheInvalidation(): UseCacheInvalidationResult {
  const [isInvalidating, setIsInvalidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invalidate = useCallback(async (options: CacheInvalidateOptions) => {
    setIsInvalidating(true);
    setError(null);
    try {
      await cacheApi.invalidate(options);
      // Refresh cache status immediately after successful invalidation
      await mutate(CACHE_STATUS_KEY);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Cache invalidation failed';
      setError(message);
    } finally {
      setIsInvalidating(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { invalidate, isInvalidating, error, clearError };
}
