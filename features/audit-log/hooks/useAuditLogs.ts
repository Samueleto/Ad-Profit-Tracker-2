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

export interface UseAuditLogsResult {
  logs: AuditLog[];
  initialLoading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
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

async function getToken(): Promise<string | null> {
  return (await getAuth().currentUser?.getIdToken()) ?? null;
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
  return JSON.stringify(log.metadata).toLowerCase().includes(q) ||
    log.action.toLowerCase().includes(q) ||
    log.resourceType?.toLowerCase().includes(q);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuditLogs(): UseAuditLogsResult {
  const [allLogs, setAllLogs] = useState<AuditLog[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      const token = await getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const qs = buildQueryParams(filters, currentCursor);
      const res = await fetch(`/api/audit/logs${qs ? `?${qs}` : ''}`, { headers });
      if (fetchId !== fetchIdRef.current) return; // stale response
      if (!res.ok) { setError('Failed to load audit logs.'); return; }
      const data = await res.json();
      const newLogs: AuditLog[] = data.logs ?? [];
      if (append) {
        setAllLogs(prev => [...prev, ...newLogs]);
      } else {
        setAllLogs(newLogs);
      }
      setHasMore(data.hasMore ?? !!data.nextCursor);
      setCursor(data.nextCursor ?? null);
    } catch (err) {
      if (fetchId === fetchIdRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load audit logs.');
      }
    } finally {
      if (fetchId === fetchIdRef.current) {
        setInitialLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  // Initial fetch + filter reset
  const filtersRef = useRef(activeFilters);
  filtersRef.current = activeFilters;
  useEffect(() => {
    fetchLogs(activeFilters, null, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilters, fetchLogs]);

  // Load more
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
    setActiveFilters(prev => ({ ...prev })); // trigger useEffect
  }, []);

  // Client-side search filtering
  const logs = activeFilters.searchText
    ? allLogs.filter(l => matchesSearch(l, activeFilters.searchText))
    : allLogs;

  return {
    logs,
    initialLoading,
    loadingMore,
    hasMore,
    error,
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
