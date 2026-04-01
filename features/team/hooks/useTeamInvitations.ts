'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAuthHeaders } from '@/lib/auth/getAuthHeaders';
import type { WorkspaceInvitationSafe } from '../types';

export interface UseTeamInvitationsResult {
  invitations: WorkspaceInvitationSafe[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useTeamInvitations(): UseTeamInvitationsResult {
  const [invitations, setInvitations] = useState<WorkspaceInvitationSafe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvitations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/team/invitations', { headers });
      if (!res.ok) { setError('Failed to load invitations.'); return; }
      const data = await res.json();
      setInvitations(data.invitations ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invitations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInvitations(); }, [fetchInvitations]);

  return { invitations, loading, error, refresh: fetchInvitations };
}
