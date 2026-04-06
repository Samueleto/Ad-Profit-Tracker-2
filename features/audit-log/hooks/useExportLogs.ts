'use client';

import { useState, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import { format } from 'date-fns';
import type { ActiveFilters } from './useAuditLogs';

export type ExportErrorCode = 'UNAUTHORIZED' | 'RATE_LIMITED' | 'SERVER_ERROR' | 'NETWORK_ERROR';

export interface ExportError {
  code: ExportErrorCode;
  message: string;
}

export interface UseExportLogsResult {
  isExporting: boolean;
  exportError: ExportError | null;
  exportLogs: (filters: ActiveFilters) => Promise<void>;
}

export function useExportLogs(): UseExportLogsResult {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<ExportError | null>(null);

  const exportLogs = useCallback(async (filters: ActiveFilters) => {
    setIsExporting(true);
    setExportError(null);
    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      const freshToken = async () => await auth.currentUser?.getIdToken(true).catch(() => null);

      const makeRequest = async (t: string | null | undefined) => {
        const params = new URLSearchParams();
        if (filters.selectedActions.length) params.set('action', filters.selectedActions.join(','));
        if (filters.dateRange.startDate) params.set('startDate', filters.dateRange.startDate);
        if (filters.dateRange.endDate) params.set('endDate', filters.dateRange.endDate);
        if (filters.dateRange.preset) params.set('preset', filters.dateRange.preset);
        if (filters.searchText) params.set('search', filters.searchText);
        if (filters.status) params.set('status', filters.status);
        return fetch(`/api/audit-logs/export?${params.toString()}`, {
          headers: { ...(t ? { Authorization: `Bearer ${t}` } : {}) },
        });
      };

      let res = await makeRequest(token);
      if (res.status === 401) {
        const ft = await freshToken();
        res = await makeRequest(ft);
        if (res.status === 401) {
          setExportError({ code: 'UNAUTHORIZED', message: 'Session expired — please sign in again.' });
          return;
        }
      }
      if (res.status === 429) {
        setExportError({ code: 'RATE_LIMITED', message: 'Export limit reached — you can export up to 5 times per hour.' });
        return;
      }
      if (!res.ok) {
        setExportError({ code: 'SERVER_ERROR', message: 'Export failed — please try again.' });
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      const offline = typeof navigator !== 'undefined' && !navigator.onLine;
      setExportError({
        code: offline ? 'NETWORK_ERROR' : 'SERVER_ERROR',
        message: offline ? 'No internet connection — check your network and try again.' : 'Export failed — please try again.',
      });
    } finally {
      setIsExporting(false);
    }
  }, []);

  return { isExporting, exportError, exportLogs };
}
