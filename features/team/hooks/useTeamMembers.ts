'use client';

import { useState, useEffect, useCallback } from 'react';
import { authFetch, SessionExpiredError } from '@/lib/auth/teamAuthFetch';
import type { WorkspaceMember } from '../types';

export interface UseTeamMembersResult {
  members: WorkspaceMember[];
  loading: boolean;
  error: string | null;
  sessionExpired: boolean;
  refresh: () => void;
}

export function useTeamMembers(): UseTeamMembersResult {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSessionExpired(false);
    try {
      const res = await authFetch('/api/team/members');
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
      if (err instanceof SessionExpiredError) {
        setSessionExpired(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load members.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  return { members, loading, error, sessionExpired, refresh: fetchMembers };
}
