'use client';

import { useState, useCallback } from 'react';
import { getAuth } from 'firebase/auth';

export interface UseClearLogsResult {
  isClearing: boolean;
  clearError: string | null;
  clearLogs: () => Promise<number>;
}

export function useClearLogs(): UseClearLogsResult {
  const [isClearing, setIsClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);

  const clearLogs = useCallback(async (): Promise<number> => {
    setIsClearing(true);
    setClearError(null);
    try {
      const token = await getAuth().currentUser?.getIdToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch('/api/audit/logs/clear', { method: 'DELETE', headers });
      if (!res.ok) throw new Error('Failed to clear logs.');
      const data = await res.json().catch(() => ({}));
      return data.deletedCount ?? 0;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to clear logs.';
      setClearError(msg);
      throw new Error(msg);
    } finally {
      setIsClearing(false);
    }
  }, []);

  return { isClearing, clearError, clearLogs };
}
