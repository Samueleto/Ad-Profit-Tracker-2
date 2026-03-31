'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { addDays, addMonths, setHours, setMinutes, setSeconds, setMilliseconds, nextDay } from 'date-fns';
import { toZonedTime, fromZonedTime, format } from 'date-fns-tz';
import type {
  ScheduledReport,
  ScheduleFrequency,
  ScheduleFormat,
  ScheduleDatePreset,
} from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScheduleFormValues {
  frequency: ScheduleFrequency;
  dayOfWeek: number; // 0=Sun, 6=Sat
  dayOfMonth: number; // 1–28
  deliveryHour: number; // 0–23
  timezone: string;
  deliveryEmail: string;
  dateRangePreset: ScheduleDatePreset;
  format: ScheduleFormat;
  isActive: boolean;
}

export type ScheduleFormErrors = Partial<Record<keyof ScheduleFormValues, string>> & {
  general?: string;
};

export interface UseScheduleFormResult {
  form: ScheduleFormValues;
  existingSchedule: ScheduledReport | null;
  loading: boolean;
  saving: boolean;
  errors: ScheduleFormErrors;
  nextDeliveryPreview: string;
  updateField: <K extends keyof ScheduleFormValues>(field: K, value: ScheduleFormValues[K]) => void;
  fetchSchedule: (reportId: string) => Promise<void>;
  saveSchedule: (reportId: string, reportName?: string) => Promise<boolean>;
  deleteSchedule: () => Promise<boolean>;
  sendTestNow: () => Promise<void>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

function getCurrentUserEmail(): string {
  const auth = getAuth();
  return auth.currentUser?.email ?? '';
}

async function getFreshToken(refresh = false): Promise<string | undefined> {
  const auth = getAuth();
  return auth.currentUser?.getIdToken(refresh);
}

function buildAuthHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

// Basic email validation — prevents obviously malformed addresses from hitting the server
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

// Friendly rate limit messages per endpoint type
const RATE_LIMIT_MESSAGES: Record<string, string> = {
  create: "You've reached the schedule limit. Try again later.",
  update: 'Too many updates. Please wait before trying again.',
  delete: 'Too many deletes. Please wait before trying again.',
  sendNow: 'Too many test emails. Please wait before trying again.',
};

// Auth fetch with 401 retry: tries with cached token, retries with force-refresh on 401.
// Returns the response; callers inspect status and call onExpired if still 401.
async function scheduleAuthFetch(
  url: string,
  init: RequestInit = {},
  onExpired?: () => void
): Promise<Response> {
  const makeReq = async (refresh: boolean) => {
    const token = await getFreshToken(refresh);
    return fetch(url, { ...init, headers: buildAuthHeaders(token) });
  };
  let res = await makeReq(false);
  if (res.status === 401) {
    res = await makeReq(true);
    if (res.status === 401) {
      // Session genuinely expired — redirect to sign-in
      onExpired?.();
      window.location.replace('/');
    }
  }
  return res;
}

function computeNextDelivery(
  frequency: ScheduleFrequency,
  dayOfWeek: number,
  dayOfMonth: number,
  deliveryHour: number,
  timezone: string
): string {
  try {
    const nowUtc = new Date();
    const nowInTz = toZonedTime(nowUtc, timezone);

    // Candidate = today at deliveryHour in the given timezone
    let candidate = setMilliseconds(setSeconds(setMinutes(setHours(nowInTz, deliveryHour), 0), 0), 0);

    if (frequency === 'daily') {
      // If this hour already passed today, push to tomorrow
      if (candidate <= nowInTz) {
        candidate = addDays(candidate, 1);
      }
    } else if (frequency === 'weekly') {
      // Find the next occurrence of dayOfWeek (0=Sun)
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
      const targetDay = days[dayOfWeek] ?? 'Mon';
      // nextDay from date-fns gives the next occurrence after the given date
      candidate = setHours(nextDay(nowInTz, dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6), deliveryHour);
      candidate = setMilliseconds(setSeconds(setMinutes(candidate, 0), 0), 0);
      // If "next day" lands on today and hour hasn't passed yet, use today
      const todayCandidate = setMilliseconds(setSeconds(setMinutes(setHours(nowInTz, deliveryHour), 0), 0), 0);
      if (nowInTz.getDay() === dayOfWeek && todayCandidate > nowInTz) {
        candidate = todayCandidate;
      }
      void targetDay; // suppress unused
    } else if (frequency === 'monthly') {
      // This month's dayOfMonth
      candidate = setMilliseconds(
        setSeconds(setMinutes(setHours(new Date(nowInTz.getFullYear(), nowInTz.getMonth(), dayOfMonth), deliveryHour), 0), 0),
        0
      );
      if (candidate <= nowInTz) {
        // Push to next month
        candidate = addMonths(candidate, 1);
      }
    }

    // Convert back to UTC to check it's in the future, then format in the target tz
    const candidateUtc = fromZonedTime(candidate, timezone);
    if (candidateUtc <= nowUtc) {
      // Safety fallback: nudge one period ahead
      if (frequency === 'daily') candidate = addDays(candidate, 1);
      else if (frequency === 'weekly') candidate = addDays(candidate, 7);
      else candidate = addMonths(candidate, 1);
    }

    const diffMs = fromZonedTime(candidate, timezone).getTime() - nowUtc.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    const timeStr = format(candidate, 'h:mm aa zzz', { timeZone: timezone });

    if (diffDays === 0) return `Today at ${timeStr}`;
    if (diffDays === 1) return `Tomorrow at ${timeStr}`;
    if (diffDays < 7) {
      const dayName = format(candidate, 'EEEE', { timeZone: timezone });
      return `${dayName} at ${timeStr}`;
    }
    const dateStr = format(candidate, 'MMM d', { timeZone: timezone });
    return `${dateStr} at ${timeStr}`;
  } catch {
    return '—';
  }
}

// ─── Default form values ──────────────────────────────────────────────────────

function buildDefaults(): ScheduleFormValues {
  return {
    frequency: 'daily',
    dayOfWeek: 1, // Monday
    dayOfMonth: 1,
    deliveryHour: 8,
    timezone: getBrowserTimezone(),
    deliveryEmail: getCurrentUserEmail(),
    dateRangePreset: 'last_7',
    format: 'excel',
    isActive: true,
  };
}

function scheduleToFormValues(schedule: ScheduledReport): ScheduleFormValues {
  return {
    frequency: schedule.frequency,
    dayOfWeek: schedule.dayOfWeek ?? 1,
    dayOfMonth: schedule.dayOfMonth ?? 1,
    deliveryHour: schedule.deliveryHour,
    timezone: schedule.timezone,
    deliveryEmail: schedule.deliveryEmail,
    dateRangePreset: schedule.dateRangePreset,
    format: schedule.format,
    isActive: schedule.isActive,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useScheduleForm(onSuccess?: () => void, onExpired?: () => void): UseScheduleFormResult {
  const [form, setForm] = useState<ScheduleFormValues>(buildDefaults);
  const [existingSchedule, setExistingSchedule] = useState<ScheduledReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<ScheduleFormErrors>({});

  // Sync email from Firebase Auth when user becomes available
  useEffect(() => {
    const email = getCurrentUserEmail();
    if (email) {
      setForm(prev => prev.deliveryEmail ? prev : { ...prev, deliveryEmail: email });
    }
  }, []);

  const nextDeliveryPreview = useMemo(
    () => computeNextDelivery(form.frequency, form.dayOfWeek, form.dayOfMonth, form.deliveryHour, form.timezone),
    [form.frequency, form.dayOfWeek, form.dayOfMonth, form.deliveryHour, form.timezone]
  );

  const updateField = useCallback(<K extends keyof ScheduleFormValues>(
    field: K,
    value: ScheduleFormValues[K]
  ) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => {
      if (!prev[field as keyof ScheduleFormErrors]) return prev;
      const next = { ...prev };
      delete next[field as keyof ScheduleFormErrors];
      return next;
    });
  }, []);

  const fetchSchedule = useCallback(async (reportId: string) => {
    setLoading(true);
    setErrors({});
    try {
      const res = await scheduleAuthFetch(
        `/api/schedules?reportId=${encodeURIComponent(reportId)}`,
        {},
        onExpired
      );
      if (!res.ok) {
        setErrors({ general: `Failed to load schedule (${res.status}).` });
        return;
      }
      const data = await res.json();
      const schedule: ScheduledReport | null = data.schedule ?? null;
      setExistingSchedule(schedule);
      if (schedule) {
        setForm(scheduleToFormValues(schedule));
      }
    } catch {
      setErrors({ general: 'Failed to load schedule.' });
    } finally {
      setLoading(false);
    }
  }, [onExpired]);

  const saveSchedule = useCallback(async (reportId: string, reportName = ''): Promise<boolean> => {
    if (saving) return false;

    // Client-side email validation before any API call
    const trimmedEmail = form.deliveryEmail.trim();
    if (!trimmedEmail || !isValidEmail(trimmedEmail)) {
      setErrors({ deliveryEmail: 'Please enter a valid email address.' });
      return false;
    }

    setSaving(true);
    setErrors({});
    try {
      const isNew = !existingSchedule;

      const payload = isNew
        ? {
            reportId,
            reportName,
            frequency: form.frequency,
            ...(form.frequency === 'weekly' ? { dayOfWeek: form.dayOfWeek } : {}),
            ...(form.frequency === 'monthly' ? { dayOfMonth: form.dayOfMonth } : {}),
            deliveryHour: form.deliveryHour,
            timezone: form.timezone,
            deliveryEmail: trimmedEmail, // always trimmed
            dateRangePreset: form.dateRangePreset,
            format: form.format,
            isActive: form.isActive,
          }
        : {
            frequency: form.frequency,
            ...(form.frequency === 'weekly' ? { dayOfWeek: form.dayOfWeek } : {}),
            ...(form.frequency === 'monthly' ? { dayOfMonth: form.dayOfMonth } : {}),
            deliveryHour: form.deliveryHour,
            timezone: form.timezone,
            deliveryEmail: trimmedEmail, // always trimmed
            dateRangePreset: form.dateRangePreset,
            format: form.format,
            isActive: form.isActive,
          };

      const url = isNew ? '/api/schedules/create' : `/api/schedules/${existingSchedule!.id}`;
      const method = isNew ? 'POST' : 'PATCH';

      const res = await scheduleAuthFetch(url, { method, body: JSON.stringify(payload) }, onExpired);

      if (res.status === 400) {
        const body = await res.json().catch(() => ({}));
        setErrors(body.fieldErrors ?? { general: body.message ?? 'Validation failed.' });
        return false;
      }
      if (res.status === 429) {
        setErrors({ general: isNew ? RATE_LIMIT_MESSAGES.create : RATE_LIMIT_MESSAGES.update });
        return false;
      }
      if (!res.ok) {
        setErrors({ general: `Save failed (${res.status}).` });
        return false;
      }

      const data = await res.json();
      const saved: ScheduledReport = data.schedule ?? data;
      setExistingSchedule(saved);
      onSuccess?.();
      return true;
    } catch {
      setErrors({ general: 'Failed to save schedule.' });
      return false;
    } finally {
      setSaving(false);
    }
  }, [saving, existingSchedule, form, onSuccess, onExpired]);

  const deleteSchedule = useCallback(async (): Promise<boolean> => {
    if (!existingSchedule || saving) return false;
    setSaving(true);
    setErrors({});
    try {
      const res = await scheduleAuthFetch(
        `/api/schedules/${existingSchedule.id}`,
        { method: 'DELETE' },
        onExpired
      );
      if (res.status === 429) {
        setErrors({ general: RATE_LIMIT_MESSAGES.delete });
        return false;
      }
      if (!res.ok) {
        setErrors({ general: `Delete failed (${res.status}).` });
        return false;
      }
      setExistingSchedule(null);
      setForm(buildDefaults());
      onSuccess?.();
      return true;
    } catch {
      setErrors({ general: 'Failed to delete schedule.' });
      return false;
    } finally {
      setSaving(false);
    }
  }, [existingSchedule, saving, onSuccess, onExpired]);

  const sendTestNow = useCallback(async () => {
    if (!existingSchedule) return;
    setErrors({});
    try {
      // No request body — delivery email comes from the stored schedule on the server
      const res = await scheduleAuthFetch(
        `/api/schedules/${existingSchedule.id}/send-now`,
        { method: 'POST' },
        onExpired
      );
      if (res.status === 429) {
        setErrors({ general: RATE_LIMIT_MESSAGES.sendNow });
      } else if (!res.ok) {
        setErrors({ general: `Send failed (${res.status}).` });
      }
    } catch {
      setErrors({ general: 'Failed to send test email.' });
    }
  }, [existingSchedule, onExpired]);

  return {
    form,
    existingSchedule,
    loading,
    saving,
    errors,
    nextDeliveryPreview,
    updateField,
    fetchSchedule,
    saveSchedule,
    deleteSchedule,
    sendTestNow,
  };
}
