'use client';

import { useState, useCallback } from 'react';
import { getAuth } from 'firebase/auth';

export type ClearErrorCode = 'UNAUTHORIZED' | 'RATE_LIMITED' | 'SERVER_ERROR' | 'NETWORK_ERROR' | 'PARTIAL_FAILURE';

export interface ClearError {
  code: ClearErrorCode;
  message: string;
}

export interface UseClearLogsResult {
  isClearing: boolean;
  clearError: ClearError | null;
  clearLogs: () => Promise<number>;
}

export function useClearLogs(): UseClearLogsResult {
  const [isClearing, setIsClearing] = useState(false);
  const [clearError, setClearError] = useState<ClearError | null>(null);

  const clearLogs = useCallback(async (): Promise<number> => {
    setIsClearing(true);
    setClearError(null);
    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      let res = await fetch('/api/audit/logs/clear', { method: 'DELETE', headers });

      if (res.status === 401) {
        const freshToken = await auth.currentUser?.getIdToken(true).catch(() => null);
        if (!freshToken) {
          const err: ClearError = { code: 'UNAUTHORIZED', message: 'Session expired — please sign in again.' };
          setClearError(err);
          throw new Error(err.message);
        }
        res = await fetch('/api/audit/logs/clear', {
          method: 'DELETE',
          headers: { ...headers, Authorization: `Bearer ${freshToken}` },
        });
        if (res.status === 401) {
          const err: ClearError = { code: 'UNAUTHORIZED', message: 'Session expired — please sign in again.' };
          setClearError(err);
          throw new Error(err.message);
        }
      }

      if (res.status === 429) {
        const err: ClearError = { code: 'RATE_LIMITED', message: 'Too many requests — please wait a moment.' };
        setClearError(err);
        throw new Error(err.message);
      }

      if (!res.ok) {
        const err: ClearError = { code: 'SERVER_ERROR', message: 'Failed to clear logs — some entries may not have been deleted.' };
        setClearError(err);
        throw new Error(err.message);
      }

      const data = await res.json().catch(() => ({}));
      return data.deletedCount ?? 0;
    } catch (err) {
      if (!clearError) {
        const offline = typeof navigator !== 'undefined' && !navigator.onLine;
        const e: ClearError = {
          code: offline ? 'NETWORK_ERROR' : 'SERVER_ERROR',
          message: offline
            ? 'No internet connection — check your network and try again.'
            : 'Failed to clear logs — some entries may not have been deleted.',
        };
        setClearError(e);
      }
      throw err;
    } finally {
      setIsClearing(false);
    }
  }, [clearError]);

  return { isClearing, clearError, clearLogs };
}
