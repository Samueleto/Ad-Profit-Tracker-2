'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Trash2, Loader2, AlertCircle, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { getAuth } from 'firebase/auth';
import type { AuditLog, LogFilters, PaginatedLogsResponse } from '../types';
import AuditFilterBar from './AuditFilterBar';
import LogTableRow from './LogTableRow';
import ClearLogsDialog from './ClearLogsDialog';

const PAGE_SIZE = 25;

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

function buildQuery(filters: LogFilters, cursor?: string | null): string {
  const params = new URLSearchParams();
  params.set('limit', String(PAGE_SIZE));
  if (filters.action?.length) params.set('action', filters.action.join(','));
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);
  if (filters.status) params.set('status', filters.status);
  if (filters.search) params.set('search', filters.search);
  if (cursor) params.set('cursor', cursor);
  return params.toString();
}

type LoadState = 'loading' | 'success' | 'error' | 'offline';

export default function ActivityLogTab() {
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filters, setFilters] = useState<LogFilters>({});
  const [dateValidationError, setDateValidationError] = useState<string | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const handleSessionExpired = useCallback(() => {
    toast.error('Session expired — please sign in again.');
    router.replace('/');
  }, [router]);

  const fetchLogs = useCallback(async (activeFilters: LogFilters) => {
    // Date range validation
    if (activeFilters.startDate && activeFilters.endDate && activeFilters.endDate < activeFilters.startDate) {
      setDateValidationError('End date cannot be before start date.');
      return;
    }
    setDateValidationError(null);
    setLoadState('loading');
    setNextCursor(null);
    try {
      const { res, sessionExpired } = await authFetch(`/api/audit-logs?${buildQuery(activeFilters)}`);
      if (sessionExpired) { handleSessionExpired(); return; }
      if (res.status === 403) { setAccessDenied(true); return; }
      if (res.status === 429) {
        toast.warning('Too many requests — please wait a moment before trying again.');
        setLoadState('error');
        return;
      }
      if (!res.ok) { setLoadState('error'); return; }
      const data: PaginatedLogsResponse = await res.json();
      setLogs(data.logs);
      setTotal(data.total);
      setNextCursor(data.nextCursor);
      setLoadState('success');
    } catch {
      const offline = typeof navigator !== 'undefined' && !navigator.onLine;
      setLoadState(offline ? 'offline' : 'error');
    }
  }, [handleSessionExpired]);

  useEffect(() => { fetchLogs(filters); }, [fetchLogs, filters]);

  const handleFiltersChange = useCallback((newFilters: LogFilters) => {
    setFilters(newFilters);
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters({});
    setDateValidationError(null);
  }, []);

  const handleLoadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    setLoadMoreError(false);
    try {
      const { res, sessionExpired } = await authFetch(`/api/audit-logs?${buildQuery(filters, nextCursor)}`);
      if (sessionExpired) { handleSessionExpired(); return; }
      if (!res.ok) { setLoadMoreError(true); return; }
      const data: PaginatedLogsResponse = await res.json();
      setLogs(prev => [...prev, ...data.logs]);
      setNextCursor(data.nextCursor);
    } catch {
      setLoadMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      const params = new URLSearchParams();
      if (filters.action?.length) params.set('action', filters.action.join(','));
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);
      if (filters.status) params.set('status', filters.status);
      if (filters.search) params.set('search', filters.search);

      let res = await fetch(`/api/audit-logs/export?${params.toString()}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });

      if (res.status === 401) {
        const freshToken = await auth.currentUser?.getIdToken(true).catch(() => null);
        if (!freshToken) { handleSessionExpired(); return; }
        res = await fetch(`/api/audit-logs/export?${params.toString()}`, {
          headers: { Authorization: `Bearer ${freshToken}` },
        });
        if (res.status === 401) { handleSessionExpired(); return; }
      }

      if (res.status === 429) {
        toast.warning('Export limit reached — you can export up to 5 times per hour.');
        return;
      }
      if (!res.ok) {
        toast.error('Export failed — please try again.');
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed — please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleClearConfirm = async () => {
    const { res, sessionExpired } = await authFetch('/api/audit-logs/clear', { method: 'DELETE' });
    if (sessionExpired) { handleSessionExpired(); return; }
    if (res.status === 429) {
      toast.warning('Too many requests — please wait a moment before trying again.');
      return;
    }
    if (!res.ok) {
      toast.error('Failed to clear logs — some entries may not have been deleted.');
      return;
    }
    const data = await res.json().catch(() => ({}));
    setLogs([]);
    setTotal(0);
    setNextCursor(null);
    const count = data?.deletedCount ?? data?.count ?? null;
    toast.success(count != null ? `Cleared ${count} activity log ${count === 1 ? 'entry' : 'entries'}.` : 'All audit logs cleared.');
  };

  const hasFilters = !!(filters.action?.length || filters.startDate || filters.status || filters.search);

  if (accessDenied) {
    return (
      <div className="flex items-center gap-2 px-4 py-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
        <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0" />
        <span className="text-sm text-red-700 dark:text-red-400">
          Access Denied.{' '}
          <a href="/dashboard" className="underline hover:no-underline">Go to Dashboard</a>
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <AuditFilterBar onFiltersChange={handleFiltersChange} />

      {/* Date validation error */}
      {dateValidationError && (
        <p className="text-xs text-red-500">{dateValidationError}</p>
      )}

      {/* Table */}
      {loadState === 'loading' ? (
        <div className="animate-pulse space-y-0">
          <div className="grid grid-cols-5 gap-4 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
            {['Timestamp', 'Action', 'Resource', 'Details', ''].map((h, i) => (
              <div key={i} className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
            ))}
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="grid grid-cols-5 gap-4 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded" />
              <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded-full" />
              <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-2/3" />
              <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-3/4" />
              <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-4 ml-auto" />
            </div>
          ))}
        </div>
      ) : loadState === 'offline' ? (
        <div className="flex items-center justify-between px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <span className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            You appear to be offline. Check your connection and retry.
          </span>
          <button onClick={() => fetchLogs(filters)} className="text-xs text-amber-700 dark:text-amber-400 underline hover:no-underline ml-3">
            Retry
          </button>
        </div>
      ) : loadState === 'error' ? (
        <div className="flex items-center justify-between px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <span className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Something went wrong loading your activity log.
          </span>
          <button onClick={() => fetchLogs(filters)} className="text-xs text-red-700 dark:text-red-400 underline hover:no-underline ml-3">
            Retry
          </button>
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12">
          {hasFilters ? (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">No logs found matching your filters.</p>
              <button
                onClick={handleResetFilters}
                className="text-xs text-blue-600 dark:text-blue-400 underline"
              >
                Reset filters
              </button>
            </>
          ) : (
            <>
              <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center">
                <span className="text-2xl">📋</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                No activity recorded yet — actions like saving API keys and updating settings will appear here.
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Row count */}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Showing 1–{logs.length} of {total} events
          </p>

          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                  {['Timestamp', 'Action', 'Resource', 'Details', 'Status'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {logs.map(log => (
                  <LogTableRow key={log.id} log={log} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Load more error */}
          {loadMoreError && (
            <div className="flex items-center justify-between px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <span className="text-xs text-red-700 dark:text-red-400">Failed to load more entries.</span>
              <button onClick={handleLoadMore} className="text-xs text-red-700 dark:text-red-400 underline hover:no-underline ml-3">Retry</button>
            </div>
          )}

          {/* Load more */}
          {nextCursor && !loadMoreError && (
            <div className="text-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 mx-auto px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
              >
                {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Load more
              </button>
            </div>
          )}
        </>
      )}

      {/* Bottom action bar */}
      <div className="flex items-center gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          Export CSV
        </button>
        <button
          onClick={() => setClearOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear All Logs
        </button>
      </div>

      <ClearLogsDialog
        isOpen={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={handleClearConfirm}
      />
    </div>
  );
}
