// Step 297: Cache API service module
// Wraps POST /api/cache/clear (invalidate), GET /api/cache/status, and POST /api/cache/warm

import { getAuth } from 'firebase/auth';

async function getBearerToken(forceRefresh = false): Promise<string | null> {
  const auth = getAuth();
  return auth.currentUser?.getIdToken(forceRefresh) ?? null;
}

async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let token = await getBearerToken();
  let res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  // Retry once on 401 with a fresh token
  if (res.status === 401) {
    token = await getBearerToken(true);
    res = await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers as Record<string, string> ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  }
  return res;
}

export interface CacheInvalidateOptions {
  /** 'all' clears everything, 'network' clears a specific network, 'endpoint' clears specific keys */
  scope: 'all' | 'network' | 'endpoint';
  /** Optional keys (network IDs or endpoint identifiers) to clear for 'network'/'endpoint' scope */
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

export const cacheApi = {
  /**
   * GET /api/cache/status — returns current cache entries and metadata.
   * Requires a valid Firebase user session.
   */
  async getStatus(): Promise<CacheStatusResponse> {
    const res = await authedFetch('/api/cache/status');
    if (!res.ok) throw Object.assign(new Error('Cache status fetch failed'), { status: res.status });
    return res.json();
  },

  /**
   * POST /api/cache/clear — invalidates cache entries.
   * scope 'all' clears all entries; 'network'/'endpoint' clear by keys[].
   */
  async invalidate(options: CacheInvalidateOptions): Promise<{ success: boolean; cleared: number }> {
    const body: Record<string, unknown> = {};
    if (options.scope !== 'all' && options.keys?.length) {
      // Use first key as networkId for 'network' scope
      body.networkId = options.keys[0];
    }
    const res = await authedFetch('/api/cache/clear', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (res.status === 429) {
      throw Object.assign(new Error("You've invalidated the cache too many times this hour — try again later"), { status: 429 });
    }
    if (!res.ok) throw Object.assign(new Error('Cache invalidation failed'), { status: res.status });
    return res.json();
  },

  /**
   * POST /api/cache/warm — warms cache entries (internal use only).
   * Uses x-internal-secret header instead of user Bearer token.
   * NOT called from user-facing UI.
   */
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
