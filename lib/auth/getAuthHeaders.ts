'use client';

import { getAuth } from 'firebase/auth';

/**
 * Returns Authorization headers with a fresh Firebase ID token.
 * Throws if there is no signed-in user.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const auth = getAuth();
  if (!auth.currentUser) throw new Error('Not authenticated');
  const token = await auth.currentUser.getIdToken();
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}
