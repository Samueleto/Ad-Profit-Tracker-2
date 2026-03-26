'use client';

import { useState, useRef, useCallback } from 'react';
import { getAuth } from 'firebase/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DateRangeOption = 'last_7_days' | 'last_14_days' | 'last_30_days' | 'this_month';

export interface Preferences {
  timezone: string;
  currency: string;
  defaultDateRange: DateRangeOption;
  notifications: {
    dailySummaryEmail: boolean;
    weeklyReportEmail: boolean;
  };
}

const DEFAULT_PREFERENCES: Preferences = {
  timezone: 'UTC',
  currency: 'USD',
  defaultDateRange: 'last_7_days',
  notifications: { dailySummaryEmail: false, weeklyReportEmail: false },
};

export type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePreferences(initialPreferences?: Partial<Preferences>) {
  const [prefs, setPrefs] = useState<Preferences>({
    ...DEFAULT_PREFERENCES,
    ...initialPreferences,
    notifications: {
      ...DEFAULT_PREFERENCES.notifications,
      ...(initialPreferences?.notifications ?? {}),
    },
  });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // Track in-flight state to queue conflicting updates
  const savingRef = useRef(false);
  const pendingUpdateRef = useRef<Partial<Preferences> | null>(null);

  // Timezone debounce timer
  const tzDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getToken = useCallback(async (): Promise<string | null> => {
    const auth = getAuth();
    return auth.currentUser?.getIdToken() ?? null;
  }, []);

  const patch = useCallback(async (partial: Partial<Preferences>): Promise<boolean> => {
    const token = await getToken();
    if (!token) return false;
    const res = await fetch('/api/settings/preferences', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(partial),
    });
    return res.ok;
  }, [getToken]);

  const flushPending = useCallback(async () => {
    const pending = pendingUpdateRef.current;
    if (!pending) return;
    pendingUpdateRef.current = null;
    await patch(pending);
  }, [patch]);

  const updatePreference = useCallback(
    async <K extends keyof Preferences>(field: K, value: Preferences[K]) => {
      // Optimistic update
      setPrefs(prev => ({ ...prev, [field]: value }));

      const partial = { [field]: value } as Partial<Preferences>;

      // Timezone: debounce the PATCH by 400ms
      if (field === 'timezone') {
        if (tzDebounceRef.current) clearTimeout(tzDebounceRef.current);
        tzDebounceRef.current = setTimeout(async () => {
          if (savingRef.current) {
            pendingUpdateRef.current = { ...(pendingUpdateRef.current ?? {}), ...partial };
            return;
          }
          await patch(partial);
        }, 400);
        return;
      }

      // All other fields: immediate PATCH (queue if in-flight)
      if (savingRef.current) {
        pendingUpdateRef.current = { ...(pendingUpdateRef.current ?? {}), ...partial };
        return;
      }

      await patch(partial);
    },
    [patch]
  );

  const saveAll = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaveStatus('saving');
    setError(null);
    try {
      const ok = await patch(prefs);
      setSaveStatus(ok ? 'success' : 'error');
      if (!ok) setError('Failed to save preferences.');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      setSaveStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to save preferences.');
    } finally {
      savingRef.current = false;
      await flushPending();
    }
  }, [prefs, patch, flushPending]);

  return {
    prefs,
    setPrefs,
    saveStatus,
    error,
    updatePreference,
    saveAll,
  };
}
