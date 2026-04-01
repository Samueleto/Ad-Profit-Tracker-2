'use client';

import { getAuth } from 'firebase/auth';

export class SessionExpiredError extends Error {
  constructor() {
    super('session_expired');
    this.name = 'SessionExpiredError';
  }
}

/**
 * Shared fetch utility for team feature API calls.
 * Automatically attaches Firebase ID token and retries once on 401.
 * Throws SessionExpiredError if the session cannot be refreshed.
 */
export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const auth = getAuth();
  let token = await auth.currentUser?.getIdToken();
  const makeHeaders = (t: string | undefined): Record<string, string> => ({
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> ?? {}),
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  });

  let res = await fetch(path, { ...init, headers: makeHeaders(token) });

  if (res.status === 401) {
    try {
      token = await auth.currentUser?.getIdToken(true);
    } catch {
      throw new SessionExpiredError();
    }
    res = await fetch(path, { ...init, headers: makeHeaders(token) });
    if (res.status === 401) throw new SessionExpiredError();
  }

  return res;
}
