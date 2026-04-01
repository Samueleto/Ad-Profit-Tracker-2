'use client';

import { useState, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import { format } from 'date-fns';
import type { ActiveFilters } from './useAuditLogs';

export interface UseExportLogsResult {
  isExporting: boolean;
  exportError: string | null;
  exportLogs: (filters: ActiveFilters) => Promise<void>;
}

export function useExportLogs(): UseExportLogsResult {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const exportLogs = useCallback(async (filters: ActiveFilters) => {
    setIsExporting(true);
    setExportError(null);
    try {
      const token = await getAuth().currentUser?.getIdToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const params = new URLSearchParams();
      if (filters.selectedActions.length) params.set('action', filters.selectedActions.join(','));
      if (filters.dateRange.startDate) params.set('startDate', filters.dateRange.startDate);
      if (filters.dateRange.endDate) params.set('endDate', filters.dateRange.endDate);
      if (filters.dateRange.preset) params.set('preset', filters.dateRange.preset);
      if (filters.searchText) params.set('search', filters.searchText);
      if (filters.status) params.set('status', filters.status);
      const qs = params.toString();

      const res = await fetch(`/api/audit/logs/export${qs ? `?${qs}` : ''}`, { headers });
      if (!res.ok) throw new Error('Export failed.');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setIsExporting(false);
    }
  }, []);

  return { isExporting, exportError, exportLogs };
}
