'use client';

import { useState, useEffect, useCallback } from 'react';
import { authFetch, SessionExpiredError } from '@/lib/auth/teamAuthFetch';
import type { WorkspaceInvitationSafe } from '../types';

export interface UseTeamInvitationsResult {
  invitations: WorkspaceInvitationSafe[];
  loading: boolean;
  error: string | null;
  sessionExpired: boolean;
  refresh: () => void;
}

export function useTeamInvitations(): UseTeamInvitationsResult {
  const [invitations, setInvitations] = useState<WorkspaceInvitationSafe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const fetchInvitations = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSessionExpired(false);
    try {
      const res = await authFetch('/api/team/invitations');
      if (!res.ok) { setError('Failed to load invitations.'); return; }
      const data = await res.json();
      setInvitations(data.invitations ?? []);
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        setSessionExpired(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load invitations.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInvitations(); }, [fetchInvitations]);

  return { invitations, loading, error, sessionExpired, refresh: fetchInvitations };
}
