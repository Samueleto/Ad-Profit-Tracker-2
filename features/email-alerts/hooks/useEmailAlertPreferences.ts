'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getAuth } from 'firebase/auth';
import type { NotificationType } from '@/features/notifications/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RowSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface EmailPreferenceRow {
  type: NotificationType;
  enabled: boolean;
  emailEnabled: boolean;
  isDefault: boolean;
}

export type MasterToggleState = 'all' | 'none' | 'indeterminate';

export type EmailSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface UseEmailAlertPreferencesResult {
  preferences: EmailPreferenceRow[];
  alertDeliveryEmail: string;
  lastTestEmailSentAt: string | null;
  loading: boolean;
  fetchError: string | null;
  rowSaving: Record<NotificationType, RowSaveStatus>;
  masterToggleState: MasterToggleState;
  emailSaveStatus: EmailSaveStatus;
  isSendingTest: boolean;
  testError: string | null;
  toggleEmailEnabled: (type: NotificationType, newValue: boolean) => Promise<void>;
  setAllEmailEnabled: (value: boolean) => Promise<void>;
  setAlertDeliveryEmail: (email: string) => void;
  saveDeliveryEmail: () => Promise<void>;
  sendTestAlert: () => Promise<void>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getFreshToken(): Promise<string | undefined> {
  return getAuth().currentUser?.getIdToken();
}

function buildHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

const SAVED_FLASH_MS = 1500;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useEmailAlertPreferences(): UseEmailAlertPreferencesResult {
  const [preferences, setPreferences] = useState<EmailPreferenceRow[]>([]);
  const [alertDeliveryEmail, setAlertDeliveryEmail] = useState('');
  const [lastTestEmailSentAt, setLastTestEmailSentAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [rowSaving, setRowSaving] = useState<Record<string, RowSaveStatus>>({});
  const [emailSaveStatus, setEmailSaveStatus] = useState<EmailSaveStatus>('idle');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  // ─── Initial fetch ─────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const token = await getFreshToken();
        const res = await fetch('/api/notifications/preferences', { headers: buildHeaders(token) });
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const data = await res.json();
        setPreferences(data.preferences ?? []);
        setAlertDeliveryEmail(data.alertDeliveryEmail ?? '');
        setLastTestEmailSentAt(data.lastTestEmailSentAt ?? null);
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : 'Failed to load preferences.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ─── Derived master toggle ─────────────────────────────────────────────────

  const masterToggleState = useMemo<MasterToggleState>(() => {
    if (preferences.length === 0) return 'none';
    const allEnabled = preferences.every((p) => p.emailEnabled);
    const noneEnabled = preferences.every((p) => !p.emailEnabled);
    if (allEnabled) return 'all';
    if (noneEnabled) return 'none';
    return 'indeterminate';
  }, [preferences]);

  // ─── Per-toggle update ─────────────────────────────────────────────────────

  const setRowStatus = useCallback((type: NotificationType, status: RowSaveStatus) => {
    setRowSaving((prev) => ({ ...prev, [type]: status }));
  }, []);

  const toggleEmailEnabled = useCallback(async (type: NotificationType, newValue: boolean) => {
    // Optimistic update
    setPreferences((prev) =>
      prev.map((p) => (p.type === type ? { ...p, emailEnabled: newValue } : p))
    );
    setRowStatus(type, 'saving');

    try {
      const token = await getFreshToken();
      const res = await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers: buildHeaders(token),
        body: JSON.stringify({ [type]: { emailEnabled: newValue } }),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      setRowStatus(type, 'saved');
      setTimeout(() => setRowStatus(type, 'idle'), SAVED_FLASH_MS);
    } catch {
      // Rollback
      setPreferences((prev) =>
        prev.map((p) => (p.type === type ? { ...p, emailEnabled: !newValue } : p))
      );
      setRowStatus(type, 'error');
    }
  }, [setRowStatus]);

  // ─── Master toggle ─────────────────────────────────────────────────────────

  const setAllEmailEnabled = useCallback(async (value: boolean) => {
    const previous = preferences;
    // Optimistic update all rows
    setPreferences((prev) => prev.map((p) => ({ ...p, emailEnabled: value })));
    // Mark all saving
    setRowSaving(() => {
      const next: Record<string, RowSaveStatus> = {};
      for (const p of previous) next[p.type] = 'saving';
      return next;
    });

    try {
      const token = await getFreshToken();
      const payload: Record<string, { emailEnabled: boolean }> = {};
      for (const p of previous) payload[p.type] = { emailEnabled: value };
      const res = await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers: buildHeaders(token),
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      setRowSaving(() => {
        const next: Record<string, RowSaveStatus> = {};
        for (const p of previous) next[p.type] = 'saved';
        return next;
      });
      setTimeout(() => {
        setRowSaving(() => {
          const next: Record<string, RowSaveStatus> = {};
          for (const p of previous) next[p.type] = 'idle';
          return next;
        });
      }, SAVED_FLASH_MS);
    } catch {
      // Rollback
      setPreferences(previous);
      setRowSaving(() => {
        const next: Record<string, RowSaveStatus> = {};
        for (const p of previous) next[p.type] = 'error';
        return next;
      });
    }
  }, [preferences]);

  // ─── Delivery email save ───────────────────────────────────────────────────

  const saveDeliveryEmail = useCallback(async () => {
    setEmailSaveStatus('saving');
    try {
      const token = await getFreshToken();
      const res = await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers: buildHeaders(token),
        body: JSON.stringify({ alertDeliveryEmail }),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      setEmailSaveStatus('saved');
      setTimeout(() => setEmailSaveStatus('idle'), SAVED_FLASH_MS);
    } catch {
      setEmailSaveStatus('error');
    }
  }, [alertDeliveryEmail]);

  // ─── Send test alert ───────────────────────────────────────────────────────

  const sendTestAlert = useCallback(async () => {
    setIsSendingTest(true);
    setTestError(null);
    try {
      const token = await getFreshToken();
      const res = await fetch('/api/email/send-test', {
        method: 'POST',
        headers: buildHeaders(token),
      });
      if (res.status === 429) {
        setTestError('Too many test emails. Please wait before sending another.');
        return;
      }
      if (!res.ok) throw new Error(`Send failed: ${res.status}`);
      const data = await res.json();
      if (data.sentAt) setLastTestEmailSentAt(data.sentAt);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Failed to send test alert.');
    } finally {
      setIsSendingTest(false);
    }
  }, []);

  return {
    preferences,
    alertDeliveryEmail,
    lastTestEmailSentAt,
    loading,
    fetchError,
    rowSaving: rowSaving as Record<NotificationType, RowSaveStatus>,
    masterToggleState,
    emailSaveStatus,
    isSendingTest,
    testError,
    toggleEmailEnabled,
    setAllEmailEnabled,
    setAlertDeliveryEmail,
    saveDeliveryEmail,
    sendTestAlert,
  };
}
