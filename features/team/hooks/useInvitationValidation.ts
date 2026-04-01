'use client';

import { useState, useEffect, useCallback } from 'react';
import { authFetch, SessionExpiredError } from '@/lib/auth/teamAuthFetch';

// ─── Types ────────────────────────────────────────────────────────────────────

export type InvitationErrorType =
  | 'invalid_token'
  | 'expired'
  | 'already_member'
  | 'already_used'
  | 'not_found'
  | 'auth'
  | 'network'
  | null;

export interface InvitationDetails {
  workspaceName: string;
  invitedByName: string;
  role: 'admin' | 'member';
  invitedEmail: string;
}

export interface UseInvitationValidationResult {
  details: InvitationDetails | null;
  loading: boolean;
  errorType: InvitationErrorType;
  acceptInvitation: () => Promise<void>;
  declineInvitation: () => Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useInvitationValidation(token: string | null): UseInvitationValidationResult {
  const [details, setDetails] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorType, setErrorType] = useState<InvitationErrorType>(null);

  useEffect(() => {
    if (!token) {
      setErrorType('invalid_token');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await authFetch(`/api/team/invitations/validate?token=${encodeURIComponent(token)}`);
        if (res.status === 403) { setErrorType('auth'); return; }
        if (res.status === 404 || res.status === 410) { setErrorType('not_found'); return; }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const code: string = data?.code ?? '';
          if (code === 'already_member') setErrorType('already_member');
          else if (code === 'expired') setErrorType('expired');
          else if (code === 'already_used') setErrorType('already_used');
          else setErrorType('invalid_token');
          return;
        }
        const data = await res.json();
        setDetails(data.invitation ?? data);
        setErrorType(null);
      } catch (err) {
        if (err instanceof SessionExpiredError) {
          setErrorType('auth');
        } else {
          setErrorType('network');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const acceptInvitation = useCallback(async () => {
    if (!token) throw new Error('No token');
    const res = await authFetch('/api/team/invitations/accept', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const err = new Error(data?.message ?? 'Failed to accept invitation') as Error & { status?: number };
      err.status = res.status;
      throw err;
    }
  }, [token]);

  const declineInvitation = useCallback(async () => {
    if (!token) throw new Error('No token');
    const res = await authFetch('/api/team/invitations/decline', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const err = new Error(data?.message ?? 'Failed to decline invitation') as Error & { status?: number };
      err.status = res.status;
      throw err;
    }
  }, [token]);

  return { details, loading, errorType, acceptInvitation, declineInvitation };
}
