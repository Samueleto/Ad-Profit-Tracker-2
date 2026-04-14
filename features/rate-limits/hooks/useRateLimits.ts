'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAuth } from 'firebase/auth';

type NetworkId = 'exoclick' | 'rollerads' | 'zeydoo' | 'propush';
type ResetScope = 'outbound' | 'user-quota' | 'both';

// ─── Structured API error ─────────────────────────────────────────────────────

class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly extra: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ─── Shared fetch with token refresh on 401 ───────────────────────────────────

async function authFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const auth = getAuth();

  const makeHeaders = (token?: string): Record<string, string> => ({
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  const doRequest = async (refresh = false): Promise<Response> => {
    const token = await auth.currentUser?.getIdToken(refresh);
    return fetch(path, { ...init, headers: makeHeaders(token) });
  };

  let res: Response;
  try {
    res = await doRequest();
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Check your connection and try again.');
  }

  // Attempt token refresh on first 401
  if (res.status === 401) {
    try {
      res = await doRequest(true);
    } catch {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Session expired. Please sign in again.');
    }
    if (res.status === 401) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Session expired. Please sign in again.');
    }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      data?.code ?? `HTTP_${res.status}`,
      data?.message ?? `Request failed (${res.status})`,
      data
    );
  }

  return res.json() as Promise<T>;
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'FIRESTORE_READ_FAILURE' || err.code === 'LIMITER_REGISTRY_UNAVAILABLE') {
      return 'Rate limit service temporarily unavailable';
    }
    return err.message;
  }
  return err instanceof Error ? err.message : 'Something went wrong';
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
  // Backoff tracking: after 3 consecutive failures, skip polls until backoff expires
  const consecutiveFailuresRef = useRef(0);
  const nextPollAtRef = useRef(0); // epoch ms — skip poll if now < this

  const doFetch = useCallback(async (force = false) => {
    if (!force && Date.now() < nextPollAtRef.current) return; // in backoff window, skip
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
      // Reset backoff on success
      consecutiveFailuresRef.current = 0;
      nextPollAtRef.current = 0;
    } catch (err) {
      if (!mountedRef.current) return;
      consecutiveFailuresRef.current += 1;
      // After 3 consecutive failures, back off exponentially (max 8× original interval)
      if (consecutiveFailuresRef.current >= 3) {
        const backoff = Math.min(
          pollIntervalMs * Math.pow(2, consecutiveFailuresRef.current - 2),
          pollIntervalMs * 8
        );
        nextPollAtRef.current = Date.now() + backoff;
      }
      setError(errorMessage(err));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [networkId, pollIntervalMs]);

  useEffect(() => {
    mountedRef.current = true;
    consecutiveFailuresRef.current = 0;
    nextPollAtRef.current = 0;
    doFetch(true);
    // Keep polling even after failures — the handler skips if in backoff
    const id = setInterval(() => doFetch(), pollIntervalMs);
    return () => { mountedRef.current = false; clearInterval(id); };
  }, [doFetch, pollIntervalMs]);

  return { networks, userQuotas, polledAt, loading, error, refetch: () => doFetch(true) };
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
      .catch(err => setError(errorMessage(err)))
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
      if (fetchId === fetchIdRef.current) setError(errorMessage(err));
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

export interface UseRateLimitResetResult {
  reset: (networkId: NetworkId, scope: ResetScope) => Promise<void>;
  loading: boolean;
  error: string | null;
  retryAfterSeconds: number | null;
  auditLogWarning: string | null;
}

export function useRateLimitReset(onSuccess?: () => void): UseRateLimitResetResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | null>(null);
  const [auditLogWarning, setAuditLogWarning] = useState<string | null>(null);

  const reset = useCallback(async (networkId: NetworkId, scope: ResetScope) => {
    setLoading(true);
    setError(null);
    setRetryAfterSeconds(null);
    setAuditLogWarning(null);
    try {
      const data = await authFetch<{ success: boolean; cleared: number; auditLogWarning?: string }>(
        '/api/rate-limits/reset',
        { method: 'POST', body: JSON.stringify({ networkId, scope }) }
      );
      if (data.auditLogWarning) setAuditLogWarning(data.auditLogWarning);
      onSuccess?.();
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        const after = typeof err.extra?.retryAfterSeconds === 'number' ? err.extra.retryAfterSeconds : null;
        setRetryAfterSeconds(after);
        setError('Rate limit reached — try again in an hour');
      } else {
        setError(errorMessage(err));
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, [onSuccess]);

  return { reset, loading, error, retryAfterSeconds, auditLogWarning };
}
