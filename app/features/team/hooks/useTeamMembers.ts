'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import type { WorkspaceMember } from '../types';

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const auth = getAuth();
  let token = await auth.currentUser?.getIdToken();
  const makeHeaders = (t: string | undefined) => ({
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> ?? {}),
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  });
  let res = await fetch(path, { ...init, headers: makeHeaders(token) });
  if (res.status === 401) {
    token = await auth.currentUser?.getIdToken(true);
    res = await fetch(path, { ...init, headers: makeHeaders(token) });
  }
  return res;
}

export interface UseTeamMembersResult {
  members: WorkspaceMember[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useTeamMembers(): UseTeamMembersResult {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/team/members');
      if (res.status === 401) { setError('Session expired. Please sign in again.'); return; }
      if (res.status === 403) { setError('Access denied.'); return; }
      if (!res.ok) { setError('Failed to load members.'); return; }
      const data = await res.json();
      const sorted: WorkspaceMember[] = (data.members ?? []).sort(
        (a: WorkspaceMember, b: WorkspaceMember) => {
          if (a.workspaceRole === 'owner') return -1;
          if (b.workspaceRole === 'owner') return 1;
          const aTime = typeof a.workspaceJoinedAt === 'string' ? new Date(a.workspaceJoinedAt).getTime() : (a.workspaceJoinedAt as unknown as { seconds: number })?.seconds ?? 0;
          const bTime = typeof b.workspaceJoinedAt === 'string' ? new Date(b.workspaceJoinedAt).getTime() : (b.workspaceJoinedAt as unknown as { seconds: number })?.seconds ?? 0;
          return aTime - bTime;
        }
      );
      setMembers(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load members.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  return { members, loading, error, refresh: fetchMembers };
}
