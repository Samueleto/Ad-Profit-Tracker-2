'use client';

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import RoleSelector from './RoleSelector';

interface InviteMemberModalProps {
  workspaceName: string;
  onClose: () => void;
  onSuccess: (email: string) => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const auth = getAuth();
  let token = await auth.currentUser?.getIdToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  let res = await fetch(path, { ...init, headers });
  if (res.status === 401) {
    token = await auth.currentUser?.getIdToken(true);
    res = await fetch(path, {
      ...init,
      headers: { ...headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  }
  return res;
}

export default function InviteMemberModal({ workspaceName, onClose, onSuccess }: InviteMemberModalProps) {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const validateEmail = () => {
    if (!email) { setEmailError('Email is required'); return false; }
    if (!EMAIL_REGEX.test(email)) { setEmailError('Invalid email format'); return false; }
    setEmailError(null);
    return true;
  };

  const handleSubmit = async () => {
    if (!validateEmail()) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await authFetch('/api/team/invitations', {
        method: 'POST',
        body: JSON.stringify({ email, role, personalMessage: message.trim() || undefined }),
      });
      if (res.status === 409) {
        setEmailError('This person is already a member or has a pending invitation.');
        return;
      }
      if (res.status === 429) {
        setFormError('Too many invitations sent. Try again in an hour.');
        return;
      }
      if (res.status === 403) {
        setFormError('You do not have permission to invite members.');
        return;
      }
      if (!res.ok) {
        setFormError('Something went wrong. Please try again.');
        return;
      }
      onSuccess(email);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Invite Member</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">to {workspaceName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onBlur={validateEmail}
              disabled={submitting}
              placeholder="colleague@example.com"
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-50 ${
                emailError ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
            />
            {emailError && (
              <p className="mt-1 text-xs text-red-500">{emailError}</p>
            )}
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Role</label>
            <RoleSelector value={role} onChange={setRole} />
          </div>

          {/* Personal message */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Personal message <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value.slice(0, 200))}
              disabled={submitting}
              rows={3}
              placeholder="Add a personal note..."
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none disabled:opacity-50"
            />
            <p className="text-xs text-gray-400 text-right">{message.length}/200</p>
          </div>

          {formError && (
            <p className="text-xs text-red-500">{formError}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end px-5 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Send Invitation
          </button>
        </div>
      </div>
    </div>
  );
}
