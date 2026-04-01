'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import RoleBadge from '@/features/team/components/RoleBadge';
import type { WorkspaceRole } from '@/features/team/types';

interface InvitationDetails {
  workspaceName: string;
  invitedByName: string;
  role: 'admin' | 'member';
  invitedEmail: string;
}

type PageState = 'loading' | 'valid' | 'invalid' | 'already_member' | 'wrong_email' | 'not_found' | 'error';

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken();
  return fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: 'Can invite members, manage roles, and access all workspace features',
  member: 'Can access workspace features but cannot manage team settings',
};

export default function AcceptInvitationPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [pageState, setPageState] = useState<PageState>('loading');
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isAuthenticated = !!getAuth().currentUser;

  useEffect(() => {
    if (!token) { setPageState('invalid'); return; }

    const validate = async () => {
      try {
        const res = await fetch(`/api/team/invitations/validate?token=${encodeURIComponent(token)}`);
        if (res.status === 404) { setPageState('not_found'); return; }
        if (res.status === 410) { setPageState('invalid'); return; }
        if (!res.ok) { setPageState('error'); return; }
        const data = await res.json();
        if (data.alreadyMember) { setInvitation(data.invitation); setPageState('already_member'); return; }
        setInvitation(data.invitation);
        setPageState('valid');
      } catch {
        setPageState('error');
      }
    };

    validate();
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await authFetch('/api/team/invitations/accept', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      if (res.status === 403) { setErrorMessage('This invitation was sent to a different email address.'); return; }
      if (!res.ok) { setErrorMessage('Failed to accept invitation.'); return; }
      const data = await res.json();
      router.replace(`/dashboard?welcome=${encodeURIComponent(data.workspaceName ?? invitation?.workspaceName ?? '')}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      await authFetch('/api/team/invitations/decline', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      // Use replace so the invitation token is removed from browser history
      router.replace('/');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignIn = () => {
    router.push(`/?returnUrl=${encodeURIComponent(`/invite/accept?token=${token}`)}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-6">
        {pageState === 'loading' && (
          <div className="space-y-4 animate-pulse">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto" />
            <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-1/2 mx-auto" />
            <div className="h-16 bg-gray-100 dark:bg-gray-800 rounded" />
            <div className="flex gap-2">
              <div className="flex-1 h-9 bg-gray-200 dark:bg-gray-700 rounded-lg" />
              <div className="flex-1 h-9 bg-gray-100 dark:bg-gray-800 rounded-lg" />
            </div>
          </div>
        )}

        {pageState === 'valid' && invitation && (
          <>
            <div className="text-center mb-5">
              <CheckCircle className="w-10 h-10 text-blue-500 mx-auto mb-3" />
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">{invitation.workspaceName}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {invitation.invitedByName} has invited you to join as
              </p>
              <div className="mt-2 flex justify-center">
                <RoleBadge role={invitation.role as WorkspaceRole} />
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                {ROLE_DESCRIPTIONS[invitation.role]}
              </p>
            </div>

            {errorMessage && (
              <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-xs text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {errorMessage}
              </div>
            )}

            {isAuthenticated ? (
              <div className="flex gap-2">
                <button
                  onClick={handleAccept}
                  disabled={submitting}
                  className="flex-1 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
                >
                  Accept Invitation
                </button>
                <button
                  onClick={handleDecline}
                  disabled={submitting}
                  className="flex-1 py-2.5 text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  Decline
                </button>
              </div>
            ) : (
              <button
                onClick={handleSignIn}
                className="w-full py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Sign in to accept this invitation
              </button>
            )}
          </>
        )}

        {pageState === 'already_member' && invitation && (
          <div className="text-center space-y-3">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              You are already a member of <strong>{invitation.workspaceName}</strong>.
            </p>
            <a href="/dashboard" className="text-sm text-blue-600 underline">Go to Dashboard</a>
          </div>
        )}

        {pageState === 'invalid' && (
          <div className="text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
            <p className="text-sm text-gray-700 dark:text-gray-300">
              This invitation link is invalid or has expired. Please ask your workspace admin to send a new invitation.
            </p>
          </div>
        )}

        {pageState === 'not_found' && (
          <div className="text-center space-y-3">
            <p className="text-sm text-gray-700 dark:text-gray-300">Invitation not found.</p>
            <a href="/" className="text-sm text-blue-600 underline">Go Home</a>
          </div>
        )}

        {pageState === 'error' && (
          <div className="flex items-center gap-3 px-3 py-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span className="text-sm text-red-700 dark:text-red-400 flex-1">Something went wrong.</span>
            <button
              onClick={() => { setPageState('loading'); window.location.reload(); }}
              className="text-xs text-red-600 underline"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
