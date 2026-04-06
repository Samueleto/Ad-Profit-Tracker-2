'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAuth } from 'firebase/auth';
import { toast } from 'sonner';
import type {
  ReconciliationStatus,
  ReconciliationRunResult,
  AnomalyListResponse,
  RulesResponse,
  ValidationRules,
  AnomalyFlag,
} from '../types';

// ─── Shared fetch helper ──────────────────────────────────────────────────────

async function authFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
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
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

// ─── useReconciliationStatus ──────────────────────────────────────────────────

export interface UseReconciliationStatusResult {
  data: ReconciliationStatus[] | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useReconciliationStatus(networkId?: string): UseReconciliationStatusResult {
  const [data, setData] = useState<ReconciliationStatus[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const params = networkId ? `?networkId=${encodeURIComponent(networkId)}` : '';
    setLoading(true);
    authFetch<{ statuses?: ReconciliationStatus[] } | ReconciliationStatus[]>(`/api/reconciliation/status${params}`)
      .then(d => {
        setData(Array.isArray(d) ? d : (d as { statuses?: ReconciliationStatus[] }).statuses ?? []);
        setError(null);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [networkId, tick]);

  const refetch = useCallback(() => setTick(n => n + 1), []);

  return { data, loading, error, refetch };
}

// ─── useRunReconciliation ─────────────────────────────────────────────────────

export function useRunReconciliation(onComplete?: () => void) {
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<ReconciliationRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (dateFrom: string, dateTo: string, networkId?: string) => {
    setIsRunning(true);
    setError(null);
    try {
      const result = await authFetch<ReconciliationRunResult>('/api/reconciliation/run', {
        method: 'POST',
        body: JSON.stringify({ dateFrom, dateTo, ...(networkId ? { networkId } : {}) }),
      });
      setLastResult(result);
      onComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reconciliation run failed.');
    } finally {
      setIsRunning(false);
    }
  }, [onComplete]);

  return { run, isRunning, lastResult, error };
}

// ─── useAnomalies ─────────────────────────────────────────────────────────────

export type AnomalyEntry = AnomalyFlag & { id: string; date: string; networkId: string };

export interface AnomalyFilters {
  networkId?: string;
  dateFrom?: string;
  dateTo?: string;
  severity?: 'warning' | 'critical';
  anomalyType?: string;
}

export interface UseAnomaliesResult {
  anomalies: AnomalyEntry[];
  hasMore: boolean;
  initialLoading: boolean;
  loadingMore: boolean;
  error: string | null;
  filters: AnomalyFilters;
  setFilters: (f: Partial<AnomalyFilters>) => void;
  loadMore: () => void;
  removeFromList: (ids: string[]) => void;
}

export function useAnomalies(initialFilters: AnomalyFilters = {}): UseAnomaliesResult {
  const [anomalies, setAnomalies] = useState<AnomalyEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<AnomalyFilters>(initialFilters);
  const [loadMoreTrigger, setLoadMoreTrigger] = useState(0);
  const fetchIdRef = useRef(0);

  const fetchPage = useCallback(async (f: AnomalyFilters, cur: string | null, append: boolean) => {
    const fetchId = ++fetchIdRef.current;
    if (!append) setInitialLoading(true); else setLoadingMore(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (f.networkId) params.set('networkId', f.networkId);
      if (f.dateFrom) params.set('dateFrom', f.dateFrom);
      if (f.dateTo) params.set('dateTo', f.dateTo);
      if (f.severity) params.set('severity', f.severity);
      if (f.anomalyType) params.set('anomalyType', f.anomalyType);
      if (cur) params.set('cursor', cur);
      const data = await authFetch<AnomalyListResponse>(`/api/reconciliation/anomalies?${params}`);
      if (fetchId !== fetchIdRef.current) return;
      if (append) setAnomalies(prev => [...prev, ...(data.anomalies ?? [])]);
      else setAnomalies(data.anomalies ?? []);
      setHasMore(data.hasMore ?? !!data.nextCursor);
      setCursor(data.nextCursor ?? null);
    } catch (err) {
      if (fetchId === fetchIdRef.current) setError(err instanceof Error ? err.message : 'Failed to load anomalies.');
    } finally {
      if (fetchId === fetchIdRef.current) { setInitialLoading(false); setLoadingMore(false); }
    }
  }, []);

  // Reset + fetch on filter change
  useEffect(() => {
    setAnomalies([]);
    setCursor(null);
    fetchPage(filters, null, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  useEffect(() => {
    if (loadMoreTrigger === 0) return;
    fetchPage(filtersRef.current, cursorRef.current, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadMoreTrigger]);

  const setFilters = useCallback((f: Partial<AnomalyFilters>) => {
    setFiltersState(prev => ({ ...prev, ...f }));
  }, []);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    setLoadMoreTrigger(n => n + 1);
  }, [hasMore, loadingMore]);

  const removeFromList = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setAnomalies(prev => prev.filter(a => !idSet.has(a.id)));
  }, []);

  return { anomalies, hasMore, initialLoading, loadingMore, error, filters, setFilters, loadMore, removeFromList };
}

// ─── useResolveAnomalies ──────────────────────────────────────────────────────

export function useResolveAnomalies(
  removeFromList?: (ids: string[]) => void,
  onResolved?: () => void
) {
  const [isResolving, setIsResolving] = useState(false);
  const [resolvedCount, setResolvedCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resolve = useCallback(async (ids: string[], resolution: string, note?: string) => {
    setIsResolving(true);
    setError(null);
    // Optimistic removal
    removeFromList?.(ids);
    try {
      const data = await authFetch<{ resolved: number }>('/api/reconciliation/resolve', {
        method: 'PATCH',
        body: JSON.stringify({ ids, resolution, note }),
      });
      setResolvedCount(data.resolved ?? ids.length);
      onResolved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve anomalies.');
      throw err;
    } finally {
      setIsResolving(false);
    }
  }, [removeFromList, onResolved]);

  return { resolve, isResolving, resolvedCount, error };
}

// ─── useValidationRules ───────────────────────────────────────────────────────

export interface NetworkRules {
  networkId: string;
  rules: ValidationRules;
  isCustom: boolean;
  usingDefaults: (keyof ValidationRules)[];
  updatedAt: string | null;
}

export function useValidationRules() {
  const [rulesByNetwork, setRulesByNetwork] = useState<NetworkRules[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    authFetch<{ rules?: RulesResponse[] } | RulesResponse[]>('/api/reconciliation/rules')
      .then(d => {
        const list = Array.isArray(d) ? d : (d as { rules?: RulesResponse[] }).rules ?? [];
        setRulesByNetwork(list.map(r => ({
          networkId: r.networkId,
          rules: r.rules,
          isCustom: r.isCustom,
          usingDefaults: [],
          updatedAt: r.updatedAt,
        })));
        setError(null);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const updateRules = useCallback(async (networkId: string, partial: Partial<ValidationRules>) => {
    setSaving(true);
    setError(null);
    try {
      const result = await authFetch<RulesResponse>('/api/reconciliation/rules', {
        method: 'PATCH',
        body: JSON.stringify({ networkId, rules: partial }),
      });
      setRulesByNetwork(prev => prev.map(n =>
        n.networkId === networkId
          ? { ...n, rules: { ...n.rules, ...result.rules }, isCustom: result.isCustom, updatedAt: result.updatedAt }
          : n
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rules.');
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  return { rulesByNetwork, loading, saving, error, updateRules };
}
