'use client';

import { useState, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import type { ScheduledReport, CreateScheduleInput, UpdateScheduleInput } from '../types';

interface UseScheduleState {
  schedule: ScheduledReport | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  errorCode: number | null;
  sendTestLoading: boolean;
  sendTestMessage: string | null;
}

export function useSchedule(reportId: string) {
  const [state, setState] = useState<UseScheduleState>({
    schedule: null,
    loading: false,
    saving: false,
    error: null,
    errorCode: null,
    sendTestLoading: false,
    sendTestMessage: null,
  });

  const getToken = useCallback(async (refresh = false) => {
    const auth = getAuth();
    return auth.currentUser?.getIdToken(refresh);
  }, []);

  const authHeaders = useCallback(async (refresh = false): Promise<Record<string, string>> => {
    const token = await getToken(refresh);
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getToken]);

  const fetchSchedule = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null, errorCode: null }));
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/schedules?reportId=${reportId}`, { headers });
      if (res.status === 401) {
        const headers2 = await authHeaders(true);
        const res2 = await fetch(`/api/schedules?reportId=${reportId}`, { headers: headers2 });
        if (res2.status === 401) {
          setState(s => ({ ...s, loading: false, errorCode: 401 }));
          return;
        }
        const data2 = await res2.json();
        setState(s => ({ ...s, loading: false, schedule: data2.schedule ?? null }));
        return;
      }
      if (!res.ok) {
        setState(s => ({ ...s, loading: false, errorCode: res.status, error: `Error ${res.status}` }));
        return;
      }
      const data = await res.json();
      setState(s => ({ ...s, loading: false, schedule: data.schedule ?? null }));
    } catch {
      setState(s => ({ ...s, loading: false, errorCode: 500, error: 'Failed to load schedule.' }));
    }
  }, [reportId, authHeaders]);

  const saveSchedule = useCallback(async (
    input: CreateScheduleInput | UpdateScheduleInput,
    scheduleId?: string
  ): Promise<boolean> => {
    setState(s => ({ ...s, saving: true, error: null, errorCode: null }));
    try {
      const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
      const isNew = !scheduleId;
      const res = await fetch(
        isNew ? '/api/schedules' : `/api/schedules/${scheduleId}`,
        { method: isNew ? 'POST' : 'PATCH', headers, body: JSON.stringify(input) }
      );
      if (!res.ok) {
        setState(s => ({ ...s, saving: false, errorCode: res.status, error: `Save failed (${res.status})` }));
        return false;
      }
      const data = await res.json();
      setState(s => ({ ...s, saving: false, schedule: data.schedule ?? s.schedule }));
      return true;
    } catch {
      setState(s => ({ ...s, saving: false, errorCode: 500, error: 'Failed to save schedule.' }));
      return false;
    }
  }, [authHeaders]);

  const deleteSchedule = useCallback(async (scheduleId: string): Promise<boolean> => {
    setState(s => ({ ...s, saving: true, error: null }));
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/schedules/${scheduleId}`, { method: 'DELETE', headers });
      if (!res.ok) {
        setState(s => ({ ...s, saving: false, errorCode: res.status, error: `Delete failed (${res.status})` }));
        return false;
      }
      setState(s => ({ ...s, saving: false, schedule: null }));
      return true;
    } catch {
      setState(s => ({ ...s, saving: false, errorCode: 500, error: 'Failed to delete schedule.' }));
      return false;
    }
  }, [authHeaders]);

  const sendNow = useCallback(async (scheduleId: string) => {
    setState(s => ({ ...s, sendTestLoading: true, sendTestMessage: null }));
    try {
      const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' };
      const res = await fetch(`/api/schedules/${scheduleId}/trigger`, { method: 'POST', headers });
      setState(s => ({
        ...s,
        sendTestLoading: false,
        sendTestMessage: res.ok ? 'Test email sent!' : `Failed to send (${res.status})`,
      }));
    } catch {
      setState(s => ({ ...s, sendTestLoading: false, sendTestMessage: 'Failed to send test.' }));
    }
  }, [authHeaders]);

  const clearError = useCallback(() => {
    setState(s => ({ ...s, error: null, errorCode: null }));
  }, []);

  return { ...state, fetchSchedule, saveSchedule, deleteSchedule, sendNow, clearError };
}
