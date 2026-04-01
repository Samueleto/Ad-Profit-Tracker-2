/**
 * Propush API client
 *
 * Typed wrappers for all client-callable Propush endpoints.
 * Every function attaches the current user's Firebase ID token as a Bearer token.
 * If no user is signed in, the function throws before making any network request.
 *
 * NOTE: POST /api/networks/propush/scheduled-sync is an INTERNAL endpoint only.
 * It must NOT be called from the browser. Configure it as a scheduled cron job:
 *
 *   Vercel Cron (vercel.json):
 *     { "crons": [{ "path": "/api/networks/propush/scheduled-sync", "schedule": "0 3 * * *" }] }
 *     Set INTERNAL_SYNC_SECRET in Vercel environment variables.
 *
 *   Google Cloud Scheduler:
 *     URL: https://<your-domain>/api/networks/propush/scheduled-sync
 *     Method: POST  |  Schedule: 0 3 * * *
 *     Header: x-internal-secret: <INTERNAL_SYNC_SECRET>
 *
 *   GitHub Actions:
 *     cron: '0 3 * * *'
 *     curl -X POST https://<domain>/api/networks/propush/scheduled-sync \
 *          -H "x-internal-secret: ${{ secrets.INTERNAL_SYNC_SECRET }}"
 */

import { getAuth } from 'firebase/auth';

// ─── Response types ───────────────────────────────────────────────────────────

export interface PropushStatsRow {
  date: string;
  revenue: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
}

export interface PropushStatsTotals {
  revenue: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
}

export interface PropushStatsResponse {
  rows: PropushStatsRow[];
  totals: PropushStatsTotals;
}

export interface PropushCountryRow {
  countryCode: string;
  countryName: string;
  flagEmoji?: string;
  revenue: number;
  revenueShare: number;
  impressions: number;
  clicks: number;
  ctr: number;
}

export interface PropushCountryResponse {
  countries: PropushCountryRow[];
  totalRevenue: number | null;
}

export interface PropushLatestStats {
  date: string;
  revenue: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  countryCount: number;
  lastSyncedAt: string | null;
  lastSyncStatus: 'success' | 'failed' | null;
}

export interface PropushRawRecord {
  date: string;
  countryCode: string;
  rawResponse: Record<string, unknown>;
}

export interface PropushFieldSchemaEntry {
  field: string;
  type: string;
  description?: string;
}

export interface PropushRawResponse {
  records: PropushRawRecord[];
  fieldSchema: PropushFieldSchemaEntry[] | null;
}

export interface PropushSyncResult {
  rowsFetched: number;
  dateFrom: string;
  dateTo: string;
  latencyMs: number;
  syncedAt: string;
}

// ─── Token helper ─────────────────────────────────────────────────────────────

async function getToken(): Promise<string> {
  const user = getAuth().currentUser;
  if (!user) {
    throw new Error('No authenticated user. Sign in before calling Propush API functions.');
  }
  const token = await user.getIdToken();
  return token;
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const token = await getToken();
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? body?.message ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Client-callable functions ────────────────────────────────────────────────

/**
 * Trigger a manual Propush sync for the given date range.
 * Both params are optional — the backend will default to yesterday if omitted.
 */
export async function syncPropushStats(
  dateFrom?: string,
  dateTo?: string,
): Promise<PropushSyncResult> {
  const body: Record<string, string> = {};
  if (dateFrom) body.dateFrom = dateFrom;
  if (dateTo) body.dateTo = dateTo;
  return apiFetch<PropushSyncResult>('/api/networks/propush/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * Fetch Propush time-series or total stats for a date range.
 */
export async function getPropushStats(
  dateFrom: string,
  dateTo: string,
  groupBy: 'day' | 'total' = 'day',
): Promise<PropushStatsResponse> {
  const params = new URLSearchParams({ dateFrom, dateTo, groupBy });
  return apiFetch<PropushStatsResponse>(`/api/networks/propush/stats?${params}`);
}

/**
 * Fetch Propush country breakdown for a date range.
 */
export async function getPropushStatsByCountry(
  dateFrom: string,
  dateTo: string,
  limit?: number,
): Promise<PropushCountryResponse> {
  const params = new URLSearchParams({ dateFrom, dateTo });
  if (limit != null) params.set('limit', String(limit));
  return apiFetch<PropushCountryResponse>(`/api/networks/propush/stats/by-country?${params}`);
}

/**
 * Fetch the latest (most recent day) Propush stats summary.
 */
export async function getLatestPropushStats(): Promise<PropushLatestStats> {
  return apiFetch<PropushLatestStats>('/api/networks/propush/stats/latest');
}

/**
 * Fetch the raw Propush API response snapshot for a specific date.
 */
export async function getPropushRawResponse(date: string): Promise<PropushRawResponse> {
  const params = new URLSearchParams({ date });
  return apiFetch<PropushRawResponse>(`/api/networks/propush/raw-response?${params}`);
}
