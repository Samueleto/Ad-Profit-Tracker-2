// Step 297: Cache API service module
// Wraps POST /api/cache/invalidate, GET /api/cache/status, and POST /api/cache/warm

import { getAuth } from 'firebase/auth';

// ─── Typed error ──────────────────────────────────────────────────────────────

export class CacheApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly retryAfterSeconds: number | null = null
  ) {
    super(message);
    this.name = 'CacheApiError';
  }
}

// ─── Auth fetch with 401 retry ────────────────────────────────────────────────

async function getBearerToken(forceRefresh = false): Promise<string | null> {
  const auth = getAuth();
  return auth.currentUser?.getIdToken(forceRefresh) ?? null;
}

async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const makeHeaders = (token: string | null) => ({
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  let token = await getBearerToken();
  let res = await fetch(path, { ...init, headers: makeHeaders(token) });

  if (res.status === 401) {
    token = await getBearerToken(true);
    res = await fetch(path, { ...init, headers: makeHeaders(token) });
  }

  return res;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CacheInvalidateOptions {
  scope: 'all' | 'network' | 'endpoint';
  keys?: string[];
}

export interface CacheStatusResponse {
  cacheEntries: Array<{
    id: string;
    networkId: string;
    fetchedAt: string | null;
    dateFrom: string;
    dateTo: string;
    hasData: boolean;
  }>;
  total: number;
  lastChecked: string;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const cacheApi = {
  async getStatus(): Promise<CacheStatusResponse> {
    const res = await authedFetch('/api/cache/status');
    if (!res.ok) {
      throw new CacheApiError(res.status, 'Cache status fetch failed');
    }
    return res.json();
  },

  async invalidate(options: CacheInvalidateOptions): Promise<{ success: boolean; cleared: number }> {
    const body: Record<string, unknown> = { scope: options.scope };
    if (options.scope !== 'all' && options.keys?.length) {
      body.keys = options.keys;
    }
    const res = await authedFetch('/api/cache/invalidate', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      // Parse Retry-After header for 429
      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After');
        const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : null;
        throw new CacheApiError(429, 'Rate limit exceeded', retryAfterSeconds);
      }
      throw new CacheApiError(res.status, 'Cache invalidation failed');
    }

    return res.json();
  },

  async warm(secret: string): Promise<void> {
    await fetch('/api/cache/warm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': secret,
      },
    });
  },
};
