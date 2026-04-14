'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from 'next-themes';
import { getAuth } from 'firebase/auth';
import { toast } from 'sonner';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_THEME = 'light';
const DEFAULT_ACCENT = '#6366f1';
const HEX_REGEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

function isValidHex(hex: string): boolean {
  return HEX_REGEX.test(hex);
}

async function apiRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const auth = getAuth();
  const doRequest = async (forceRefresh: boolean) => {
    const token = await auth.currentUser?.getIdToken(forceRefresh);
    return fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers as Record<string, string> ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  };
  let res = await doRequest(false);
  if (res.status === 401) {
    res = await doRequest(true);
    if (res.status === 401) {
      toast.error('Session expired. Please sign in again.');
      window.location.replace('/');
      throw new Error('Session expired.');
    }
  }
  return res;
}

function applyAccentColor(hex: string): void {
  if (!isValidHex(hex)) return;
  document.documentElement.style.setProperty('--accent-color', hex);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseThemePreferencesResult {
  themePreference: string;
  accentColor: string;
  rawHexInput: string;
  isCustomAccent: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
  saveResult: 'idle' | 'success' | 'error';
  setThemePreference: (theme: string) => void;
  setAccentColor: (color: string) => void;
  setRawHexInput: (hex: string) => void;
  setIsCustomAccent: (v: boolean) => void;
  savePreferences: () => Promise<void>;
  resetToDefaults: () => Promise<void>;
}

export function useThemePreferences(): UseThemePreferencesResult {
  const { theme: nextTheme, setTheme: setNextTheme } = useTheme();
  const [themePreference, setThemePrefState] = useState(nextTheme ?? DEFAULT_THEME);
  const [accentColor, setAccentState] = useState(DEFAULT_ACCENT);
  const [rawHexInput, setRawHexInputState] = useState(DEFAULT_ACCENT);
  const [isCustomAccent, setIsCustomAccent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<'idle' | 'success' | 'error'>('idle');
  const hexDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch saved preferences on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest('/api/settings/preferences');
        if (res.ok) {
          const data = await res.json();
          const savedTheme = data.themePreference ?? DEFAULT_THEME;
          const savedAccent = data.accentColor ?? DEFAULT_ACCENT;
          setThemePrefState(savedTheme);
          setNextTheme(savedTheme);
          setAccentState(savedAccent);
          setRawHexInputState(savedAccent);
          applyAccentColor(savedAccent);
        }
      } catch { /* use defaults */ }
      finally { setLoading(false); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setThemePreference = useCallback((theme: string) => {
    setThemePrefState(theme);
    setNextTheme(theme);
  }, [setNextTheme]);

  const setAccentColor = useCallback((color: string) => {
    setAccentState(color);
    applyAccentColor(color);
  }, []);

  const setRawHexInput = useCallback((hex: string) => {
    setRawHexInputState(hex);
    if (hexDebounceRef.current) clearTimeout(hexDebounceRef.current);
    hexDebounceRef.current = setTimeout(() => {
      if (isValidHex(hex)) {
        setAccentState(hex);
        applyAccentColor(hex);
      }
    }, 400);
  }, []);

  const savePreferences = useCallback(async () => {
    setSaving(true);
    setSaveResult('idle');
    setError(null);
    try {
      const res = await apiRequest('/api/settings/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ themePreference, accentColor }),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      setSaveResult('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences.');
      setSaveResult('error');
    } finally {
      setSaving(false);
    }
  }, [themePreference, accentColor]);

  const resetToDefaults = useCallback(async () => {
    setThemePrefState(DEFAULT_THEME);
    setNextTheme(DEFAULT_THEME);
    setAccentState(DEFAULT_ACCENT);
    setRawHexInputState(DEFAULT_ACCENT);
    setIsCustomAccent(false);
    applyAccentColor(DEFAULT_ACCENT);
    // Save the defaults
    setSaving(true);
    setSaveResult('idle');
    setError(null);
    try {
      const res = await apiRequest('/api/settings/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ themePreference: DEFAULT_THEME, accentColor: DEFAULT_ACCENT }),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      setSaveResult('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset preferences.');
      setSaveResult('error');
    } finally {
      setSaving(false);
    }
  }, [setNextTheme]);

  return {
    themePreference,
    accentColor,
    rawHexInput,
    isCustomAccent,
    loading,
    saving,
    error,
    saveResult,
    setThemePreference,
    setAccentColor,
    setRawHexInput,
    setIsCustomAccent,
    savePreferences,
    resetToDefaults,
  };
}
