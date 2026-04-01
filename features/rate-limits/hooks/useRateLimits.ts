'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAuthHeaders } from '@/lib/auth/getAuthHeaders';

type NetworkId = 'exoclick' | 'rollerads' | 'zeydoo' | 'propush';
type ResetScope = 'outbound' | 'user-quota' | 'both';

// ─── Shared fetch ─────────────────────────────────────────────────────────────

async function authFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(path, {
    ...init,
    headers: { ...headers, ...(init.headers as Record<string, string> ?? {}) },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

// ─── useRateLimitStatus ───────────────────────────────────────────────────────

export interface RateLimitStatusResult {
  networks: unknown[];
  userQuotas: unknown[];
  polledAt: string | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useRateLimitStatus(networkId?: NetworkId, pollIntervalMs = 30_000): RateLimitStatusResult {
  const [networks, setNetworks] = useState<unknown[]>([]);
  const [userQuotas, setUserQuotas] = useState<unknown[]>([]);
  const [polledAt, setPolledAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const doFetch = useCallback(async () => {
    try {
      const params = networkId ? `?networkId=${networkId}` : '';
      const data = await authFetch<{ networks?: unknown[]; userQuotas?: unknown[]; polledAt?: string }>(
        `/api/rate-limits/status${params}`
      );
      if (!mountedRef.current) return;
      setNetworks(data.networks ?? []);
      setUserQuotas(data.userQuotas ?? []);
      setPolledAt(data.polledAt ?? new Date().toISOString());
      setError(null);
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : 'Failed to load rate limit status.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [networkId]);

  useEffect(() => {
    mountedRef.current = true;
    doFetch();
    const id = setInterval(doFetch, pollIntervalMs);
    return () => { mountedRef.current = false; clearInterval(id); };
  }, [doFetch, pollIntervalMs]);

  return { networks, userQuotas, polledAt, loading, error, refetch: doFetch };
}

// ─── useRateLimitConfig ───────────────────────────────────────────────────────

export function useRateLimitConfig() {
  const [networkLimiters, setNetworkLimiters] = useState<unknown>(null);
  const [userQuotaConfig, setUserQuotaConfig] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authFetch<{ networkLimiters?: unknown; userQuotaConfig?: unknown }>('/api/rate-limits/config')
      .then(data => {
        setNetworkLimiters(data.networkLimiters ?? null);
        setUserQuotaConfig(data.userQuotaConfig ?? null);
        setError(null);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { networkLimiters, userQuotaConfig, loading, error };
}

// ─── useRateLimitViolations ───────────────────────────────────────────────────

export function useRateLimitViolations(networkId?: NetworkId, endpoint?: string, limit = 20) {
  const [violations, setViolations] = useState<unknown[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreTrigger, setLoadMoreTrigger] = useState(0);
  const fetchIdRef = useRef(0);

  const fetchPage = useCallback(async (cur: string | null, append: boolean) => {
    const fetchId = ++fetchIdRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (networkId) params.set('networkId', networkId);
      if (endpoint) params.set('endpoint', endpoint);
      if (cur) params.set('cursor', cur);
      const data = await authFetch<{ violations?: unknown[]; hasMore?: boolean; nextCursor?: string | null }>(
        `/api/rate-limits/violations?${params}`
      );
      if (fetchId !== fetchIdRef.current) return;
      if (append) setViolations(prev => [...prev, ...(data.violations ?? [])]);
      else setViolations(data.violations ?? []);
      setHasMore(data.hasMore ?? !!data.nextCursor);
      setCursor(data.nextCursor ?? null);
      setError(null);
    } catch (err) {
      if (fetchId === fetchIdRef.current) setError(err instanceof Error ? err.message : 'Failed to load violations.');
    } finally {
      if (fetchId === fetchIdRef.current) setLoading(false);
    }
  }, [networkId, endpoint, limit]);

  useEffect(() => {
    setViolations([]);
    setCursor(null);
    fetchPage(null, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [networkId, endpoint, limit]);

  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;
  useEffect(() => {
    if (loadMoreTrigger === 0) return;
    fetchPage(cursorRef.current, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadMoreTrigger]);

  const loadMore = useCallback(() => {
    if (!hasMore || loading) return;
    setLoadMoreTrigger(n => n + 1);
  }, [hasMore, loading]);

  return { violations, hasMore, loading, error, loadMore };
}

// ─── useRateLimitReset ────────────────────────────────────────────────────────

export function useRateLimitReset(onSuccess?: () => void) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(async (networkId: NetworkId, scope: ResetScope) => {
    setLoading(true);
    setError(null);
    try {
      await authFetch('/api/rate-limits/reset', {
        method: 'POST',
        body: JSON.stringify({ networkId, scope }),
      });
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [onSuccess]);

  return { reset, loading, error };
}
