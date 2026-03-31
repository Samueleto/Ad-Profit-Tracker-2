'use client';

import { getAuth } from 'firebase/auth';
import { toast } from 'sonner';

// Sensitive field names to strip from displayed raw API responses
const SENSITIVE_FIELDS = new Set(['apiKey', 'accessToken', 'secret', 'password']);

/**
 * Recursively strip sensitive fields from an object before displaying it.
 * This is a client-side safety net — server-side sanitization is the primary defense.
 */
export function stripSensitiveFields(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return (obj as unknown[]).map(stripSensitiveFields);
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_FIELDS.has(k)) continue;
    result[k] = stripSensitiveFields(v);
  }
  return result;
}

/**
 * Fetch with Firebase auth token.
 * - Uses getIdToken(false) for normal requests (Firebase handles caching).
 * - On 401, retries once with getIdToken(true) to force a refresh.
 * - If retry also returns 401, treats it as session expiry:
 *   shows a 'Session expired' toast and redirects to /.
 *
 * Returns null if a session expiry redirect was triggered.
 */
export async function authFetch(
  url: string,
  init: RequestInit = {}
): Promise<Response | null> {
  const auth = getAuth();

  async function doRequest(forceRefresh: boolean): Promise<Response> {
    const token = await auth.currentUser?.getIdToken(forceRefresh);
    return fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers as Record<string, string> ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  }

  let res = await doRequest(false);

  if (res.status === 401) {
    // Retry once with force-refreshed token
    res = await doRequest(true);

    if (res.status === 401) {
      // Force-refresh also failed — session expired
      toast.error('Session expired. Please sign in again.');
      window.location.replace('/');
      return null;
    }
  }

  return res;
}

/**
 * Validated network IDs.
 */
export const VALID_NETWORK_IDS = new Set(['exoclick', 'rollerads', 'zeydoo', 'propush']);

/**
 * Clamp a date range to max 90 days.
 * Returns the clamped dateFrom (dateTo stays the same).
 * Shows a warning toast if clamping occurred.
 */
export function clampDateRange(dateFrom: string, dateTo: string): { dateFrom: string; dateTo: string; clamped: boolean } {
  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  const diffDays = Math.round((to.getTime() - from.getTime()) / 86400000);

  if (diffDays > 90) {
    const clampedFrom = new Date(to.getTime() - 90 * 86400000);
    const clampedDateFrom = clampedFrom.toISOString().split('T')[0];
    toast.warning('Date range clamped to 90 days maximum.');
    return { dateFrom: clampedDateFrom, dateTo, clamped: true };
  }

  return { dateFrom, dateTo, clamped: false };
}
