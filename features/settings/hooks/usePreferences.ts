'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
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

export const DEFAULT_PREFERENCES: Preferences = {
  timezone: 'UTC',
  currency: 'USD',
  defaultDateRange: 'last_7_days',
  notifications: { dailySummaryEmail: false, weeklyReportEmail: false },
};

export type SaveStatus = 'idle' | 'saving' | 'success';
export type LoadState = 'loading' | 'loaded' | 'error_403' | 'error_500';

export interface UsePreferencesResult {
  prefs: Preferences;
  loadState: LoadState;
  isDefaults: boolean;
  saveStatus: SaveStatus;
  fieldErrors: Record<string, string>;
  isRateLimited: boolean;
  updatePreference: <K extends keyof Preferences>(field: K, value: Preferences[K]) => void;
  saveAll: () => Promise<void>;
  fetchPreferences: () => Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePreferences(
  initialPreferences: Preferences | null,
  initialIsDefaults = false,
): UsePreferencesResult {
  const [prefs, setPrefs] = useState<Preferences>(initialPreferences ?? DEFAULT_PREFERENCES);
  const [loadState, setLoadState] = useState<LoadState>(
    initialPreferences !== null ? 'loaded' : 'loading',
  );
  const [isDefaults, setIsDefaults] = useState(initialIsDefaults);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isRateLimited, setIsRateLimited] = useState(false);

  const savingRef = useRef(false);
  const isRLRef = useRef(false); // mirror of isRateLimited for use in closures
  const pendingUpdateRef = useRef<Partial<Preferences> | null>(null);
  const tzDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rateLimitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setRL = useCallback((val: boolean) => {
    isRLRef.current = val;
    setIsRateLimited(val);
  }, []);

  const getToken = useCallback(async (refresh = false): Promise<string | null> => {
    return getAuth().currentUser?.getIdToken(refresh) ?? null;
  }, []);

  const handleSessionExpiry = useCallback(() => {
    toast.error('Session expired. Please sign in again.');
    setTimeout(() => window.location.replace('/'), 1500);
  }, []);

  // ─── GET with 401 retry ───────────────────────────────────────────────────

  const fetchPreferences = useCallback(async () => {
    setLoadState('loading');
    const makeGet = async (refresh: boolean) => {
      const token = await getToken(refresh);
      return fetch('/api/settings/preferences', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    };
    try {
      let res = await makeGet(false);
      if (res.status === 401) {
        res = await makeGet(true);
        if (res.status === 401) { handleSessionExpiry(); return; }
      }
      if (res.status === 403) { setLoadState('error_403'); return; }
      if (res.status === 404) {
        setPrefs(DEFAULT_PREFERENCES);
        setIsDefaults(true);
        setLoadState('loaded');
        return;
      }
      if (!res.ok) { setLoadState('error_500'); return; }
      const data = await res.json();
      setPrefs(data?.preferences ?? DEFAULT_PREFERENCES);
      setIsDefaults(!data?.preferences);
      setLoadState('loaded');
    } catch {
      setLoadState('error_500');
    }
  }, [getToken, handleSessionExpiry]);

  // Auto-fetch if no server-side initial data
  useEffect(() => {
    if (initialPreferences === null) fetchPreferences();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── PATCH with 401 retry ─────────────────────────────────────────────────

  const patch = useCallback(async (partial: Partial<Preferences>): Promise<Response> => {
    const makeReq = async (refresh: boolean) => {
      const token = await getToken(refresh);
      return fetch('/api/settings/preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(partial),
      });
    };
    let res = await makeReq(false);
    if (res.status === 401) {
      res = await makeReq(true);
      if (res.status === 401) handleSessionExpiry();
    }
    return res;
  }, [getToken, handleSessionExpiry]);

  const handlePatchError = useCallback(async (res: Response) => {
    if (res.status === 400) {
      // Field-level validation error — show under the specific field
      const data = await res.json().catch(() => null);
      const errors: Record<string, string> = {};
      if (data?.field && data?.message) {
        errors[data.field] = data.message;
      } else if (data?.errors && typeof data.errors === 'object') {
        Object.assign(errors, data.errors);
      } else {
        errors['_general'] = data?.error ?? 'Validation error. Please check your input.';
      }
      setFieldErrors(prev => ({ ...prev, ...errors }));
    } else if (res.status === 429) {
      toast.warning('Too many changes — please wait a moment');
      setRL(true);
      if (rateLimitTimerRef.current) clearTimeout(rateLimitTimerRef.current);
      rateLimitTimerRef.current = setTimeout(() => setRL(false), 5000);
    } else {
      // 500 or network error on PATCH — toast, keep user input intact
      toast.error('Failed to save preferences. Please try again.');
    }
  }, [setRL]);

  const flushPending = useCallback(async () => {
    const pending = pendingUpdateRef.current;
    if (!pending) return;
    pendingUpdateRef.current = null;
    try {
      const res = await patch(pending);
      if (!res.ok) await handlePatchError(res);
    } catch {
      toast.error('Failed to save preferences. Please try again.');
    }
  }, [patch, handlePatchError]);

  // ─── Optimistic field update ──────────────────────────────────────────────

  const updatePreference = useCallback(<K extends keyof Preferences>(
    field: K,
    value: Preferences[K],
  ) => {
    setPrefs(prev => ({ ...prev, [field]: value }));
    // Clear the field error when user edits the field
    setFieldErrors(prev => {
      if (!(field as string in prev)) return prev;
      const next = { ...prev };
      delete next[field as string];
      return next;
    });

    const partial = { [field]: value } as Partial<Preferences>;

    // Timezone: debounce 400ms
    if (field === 'timezone') {
      if (tzDebounceRef.current) clearTimeout(tzDebounceRef.current);
      tzDebounceRef.current = setTimeout(async () => {
        if (savingRef.current || isRLRef.current) {
          pendingUpdateRef.current = { ...(pendingUpdateRef.current ?? {}), ...partial };
          return;
        }
        try {
          const res = await patch(partial);
          if (!res.ok) await handlePatchError(res);
        } catch {
          toast.error('Failed to save preferences. Please try again.');
        }
      }, 400);
      return;
    }

    // All other fields: immediate PATCH, queue if in-flight
    if (savingRef.current || isRLRef.current) {
      pendingUpdateRef.current = { ...(pendingUpdateRef.current ?? {}), ...partial };
      return;
    }

    void (async () => {
      try {
        const res = await patch(partial);
        if (!res.ok) await handlePatchError(res);
      } catch {
        toast.error('Failed to save preferences. Please try again.');
      }
    })();
  }, [patch, handlePatchError]);

  // ─── Save all ─────────────────────────────────────────────────────────────

  const saveAll = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaveStatus('saving');
    setFieldErrors({});
    try {
      const res = await patch(prefs);
      if (res.ok) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('idle');
        await handlePatchError(res);
      }
    } catch {
      setSaveStatus('idle');
      toast.error('Failed to save preferences. Please try again.');
    } finally {
      savingRef.current = false;
      await flushPending();
    }
  }, [prefs, patch, handlePatchError, flushPending]);

  return {
    prefs,
    loadState,
    isDefaults,
    saveStatus,
    fieldErrors,
    isRateLimited,
    updatePreference,
    saveAll,
    fetchPreferences,
  };
}
