'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAuth } from 'firebase/auth';
import type { AuditLog, AuditAction, LogFilters } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DateRangePreset = '7d' | '30d' | '90d';

export interface DateRangeFilter {
  startDate?: string;
  endDate?: string;
  preset?: DateRangePreset;
}

export interface ActiveFilters {
  selectedActions: AuditAction[];
  dateRange: DateRangeFilter;
  searchText: string;
  status: 'success' | 'failure' | null;
}

const DEFAULT_FILTERS: ActiveFilters = {
  selectedActions: [],
  dateRange: {},
  searchText: '',
  status: null,
};

export type AuditLogErrorCode = 'UNAUTHORIZED' | 'FORBIDDEN' | 'SERVER_ERROR' | 'NETWORK_ERROR' | 'RATE_LIMITED' | 'NOT_FOUND';

export interface AuditLogError {
  code: AuditLogErrorCode;
  message: string;
}

export interface UseAuditLogsResult {
  logs: AuditLog[];
  initialLoading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: AuditLogError | null;
  accessDenied: boolean;
  authExpired: boolean;
  activeFilters: ActiveFilters;
  setActionFilter: (actions: AuditAction[]) => void;
  setDateRange: (range: DateRangeFilter) => void;
  setSearchText: (text: string) => void;
  setStatusFilter: (status: 'success' | 'failure' | null) => void;
  resetFilters: () => void;
  loadMore: () => void;
  refresh: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function authFetch(path: string, init: RequestInit = {}): Promise<{ res: Response; sessionExpired: boolean }> {
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken() ?? null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(path, { ...init, headers });
  if (res.status !== 401) return { res, sessionExpired: false };

  const freshToken = await auth.currentUser?.getIdToken(true).catch(() => null) ?? null;
  if (!freshToken) return { res, sessionExpired: true };
  const retryRes = await fetch(path, { ...init, headers: { ...headers, Authorization: `Bearer ${freshToken}` } });
  return { res: retryRes, sessionExpired: retryRes.status === 401 };
}

function buildQueryParams(filters: ActiveFilters, cursor?: string | null): string {
  const params = new URLSearchParams();
  if (filters.selectedActions.length) params.set('action', filters.selectedActions.join(','));
  if (filters.dateRange.startDate) params.set('startDate', filters.dateRange.startDate);
  if (filters.dateRange.endDate) params.set('endDate', filters.dateRange.endDate);
  if (filters.dateRange.preset) params.set('preset', filters.dateRange.preset);
  if (filters.searchText) params.set('search', filters.searchText);
  if (filters.status) params.set('status', filters.status);
  if (cursor) params.set('cursor', cursor);
  return params.toString();
}

function matchesSearch(log: AuditLog, searchText: string): boolean {
  if (!searchText.trim()) return true;
  const q = searchText.toLowerCase();
  const anyLog = log as unknown as Record<string, unknown>;
  const payload = anyLog.details ?? anyLog.metadata;
  return JSON.stringify(payload ?? {}).toLowerCase().includes(q) ||
    log.action.toLowerCase().includes(q) ||
    log.resourceType?.toLowerCase().includes(q);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuditLogs(): UseAuditLogsResult {
  const [allLogs, setAllLogs] = useState<AuditLog[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<AuditLogError | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [authExpired, setAuthExpired] = useState(false);
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>(DEFAULT_FILTERS);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadMoreTrigger, setLoadMoreTrigger] = useState(0);
  const fetchIdRef = useRef(0);

  const fetchLogs = useCallback(async (filters: ActiveFilters, currentCursor: string | null, append: boolean) => {
    const fetchId = ++fetchIdRef.current;
    if (!append) setInitialLoading(true);
    else setLoadingMore(true);
    setError(null);
    try {
      const qs = buildQueryParams(filters, currentCursor);
      const { res, sessionExpired } = await authFetch(`/api/audit-logs${qs ? `?${qs}` : ''}`);
      if (fetchId !== fetchIdRef.current) return;
      if (sessionExpired) { setAuthExpired(true); return; }
      if (res.status === 403) { setAccessDenied(true); return; }
      if (res.status === 429) {
        setError({ code: 'RATE_LIMITED', message: 'Too many requests — please wait a moment.' });
        return;
      }
      if (!res.ok) {
        setError({ code: 'SERVER_ERROR', message: 'Something went wrong loading your activity log.' });
        return;
      }
      const data = await res.json();
      const newLogs: AuditLog[] = data.logs ?? [];
      if (append) {
        setAllLogs(prev => [...prev, ...newLogs]);
      } else {
        setAllLogs(newLogs);
      }
      setHasMore(data.hasMore ?? !!data.nextCursor);
      setCursor(data.nextCursor ?? null);
    } catch {
      if (fetchId === fetchIdRef.current) {
        const offline = typeof navigator !== 'undefined' && !navigator.onLine;
        setError({
          code: offline ? 'NETWORK_ERROR' : 'SERVER_ERROR',
          message: offline
            ? 'You appear to be offline. Check your connection and retry.'
            : 'Something went wrong loading your activity log.',
        });
      }
    } finally {
      if (fetchId === fetchIdRef.current) {
        setInitialLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  const filtersRef = useRef(activeFilters);
  filtersRef.current = activeFilters;
  useEffect(() => {
    fetchLogs(activeFilters, null, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilters, fetchLogs]);

  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;
  useEffect(() => {
    if (loadMoreTrigger === 0) return;
    fetchLogs(filtersRef.current, cursorRef.current, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadMoreTrigger, fetchLogs]);

  const setActionFilter = useCallback((actions: AuditAction[]) => {
    setActiveFilters(prev => ({ ...prev, selectedActions: actions }));
  }, []);

  const setDateRange = useCallback((range: DateRangeFilter) => {
    setActiveFilters(prev => ({ ...prev, dateRange: range }));
  }, []);

  const setSearchText = useCallback((text: string) => {
    setActiveFilters(prev => ({ ...prev, searchText: text }));
  }, []);

  const setStatusFilter = useCallback((status: 'success' | 'failure' | null) => {
    setActiveFilters(prev => ({ ...prev, status }));
  }, []);

  const resetFilters = useCallback(() => {
    setActiveFilters({ ...DEFAULT_FILTERS });
  }, []);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    setLoadMoreTrigger(n => n + 1);
  }, [hasMore, loadingMore]);

  const refresh = useCallback(() => {
    setActiveFilters(prev => ({ ...prev }));
  }, []);

  const logs = activeFilters.searchText
    ? allLogs.filter(l => matchesSearch(l, activeFilters.searchText))
    : allLogs;

  return {
    logs,
    initialLoading,
    loadingMore,
    hasMore,
    error,
    accessDenied,
    authExpired,
    activeFilters,
    setActionFilter,
    setDateRange,
    setSearchText,
    setStatusFilter,
    resetFilters,
    loadMore,
    refresh,
  };
}
