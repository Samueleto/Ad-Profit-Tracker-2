'use client';

import { useState, useCallback, useEffect } from 'react';
import { Download, Trash2, Loader2 } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import type { AuditLog, LogFilters, PaginatedLogsResponse } from '../types';
import AuditFilterBar from './AuditFilterBar';
import LogTableRow from './LogTableRow';
import ClearLogsDialog from './ClearLogsDialog';
import { Toast } from '@/components/ui/Toast';

const PAGE_SIZE = 25;

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken();
  return fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
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

type LoadState = 'loading' | 'success' | 'error';

export default function ActivityLogTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [filters, setFilters] = useState<LogFilters>({});
  const [clearOpen, setClearOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);
  const [exporting, setExporting] = useState(false);

  const fetchLogs = useCallback(async (activeFilters: LogFilters) => {
    setLoadState('loading');
    setNextCursor(null);
    try {
      const res = await authFetch(`/api/audit/logs?${buildQuery(activeFilters)}`);
      if (!res.ok) { setLoadState('error'); return; }
      const data: PaginatedLogsResponse = await res.json();
      setLogs(data.logs);
      setTotal(data.total);
      setNextCursor(data.nextCursor);
      setLoadState('success');
    } catch {
      setLoadState('error');
    }
  }, []);

  useEffect(() => { fetchLogs(filters); }, [fetchLogs, filters]);

  const handleFiltersChange = useCallback((newFilters: LogFilters) => {
    setFilters(newFilters);
  }, []);

  const handleLoadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const res = await authFetch(`/api/audit/logs?${buildQuery(filters, nextCursor)}`);
      if (!res.ok) return;
      const data: PaginatedLogsResponse = await res.json();
      setLogs(prev => [...prev, ...data.logs]);
      setNextCursor(data.nextCursor);
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
      const res = await fetch(`/api/audit/logs/export?${params.toString()}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const handleClearConfirm = async () => {
    const res = await authFetch('/api/audit/logs/clear', { method: 'DELETE' });
    const data = res.ok ? await res.json().catch(() => ({})) : {};
    setLogs([]);
    setTotal(0);
    setNextCursor(null);
    const count = data?.deletedCount ?? data?.count ?? null;
    setToast({
      message: count != null ? `Cleared ${count} activity log ${count === 1 ? 'entry' : 'entries'}.` : 'All audit logs cleared.',
      variant: 'success',
    });
  };

  const hasFilters = !!(
    filters.action?.length || filters.startDate || filters.status || filters.search
  );

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <AuditFilterBar onFiltersChange={handleFiltersChange} />

      {toast && (
        <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />
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
      ) : loadState === 'error' ? (
        <div className="text-center py-10">
          <p className="text-sm text-red-600 dark:text-red-400 mb-2">Failed to load activity logs.</p>
          <button onClick={() => fetchLogs(filters)} className="text-xs text-blue-600 underline">Retry</button>
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12">
          {hasFilters ? (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">No logs found for the active filters.</p>
              <button
                onClick={() => handleFiltersChange({})}
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

          {/* Load more */}
          {nextCursor && (
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
