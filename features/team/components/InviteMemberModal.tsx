'use client';

import { useState } from 'react';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import { authFetch } from '@/lib/auth/teamAuthFetch';
import RoleSelector from './RoleSelector';

interface InviteMemberModalProps {
  workspaceName: string;
  onClose: () => void;
  onSuccess: (email: string) => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FormErrorType = '403' | '404' | '429' | '500' | 'network' | null;

export default function InviteMemberModal({ workspaceName, onClose, onSuccess }: InviteMemberModalProps) {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formErrorType, setFormErrorType] = useState<FormErrorType>(null);

  const setError = (msg: string, type: FormErrorType) => {
    setFormError(msg);
    setFormErrorType(type);
  };

  const clearError = () => {
    setFormError(null);
    setFormErrorType(null);
  };

  const validateEmail = () => {
    if (!email) { setEmailError('Email is required'); return false; }
    if (!EMAIL_REGEX.test(email)) { setEmailError('Invalid email format'); return false; }
    setEmailError(null);
    return true;
  };

  const handleSubmit = async () => {
    if (!validateEmail()) return;
    setSubmitting(true);
    clearError();
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
        setError('Too many invitations sent. Try again in an hour.', '429');
        return;
      }
      if (res.status === 403) {
        setError('You do not have permission to invite members.', '403');
        return;
      }
      if (res.status === 404) {
        setError('Workspace not found.', '404');
        return;
      }
      if (!res.ok) {
        setError('Something went wrong. Please try again.', '500');
        return;
      }
      onSuccess(email);
    } catch {
      setError('Check your connection and try again.', 'network');
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

          {/* Error banners */}
          {formError && formErrorType === '429' && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
              <span className="text-xs text-amber-700 dark:text-amber-300 flex-1">{formError}</span>
              <button onClick={clearError} className="text-amber-400 hover:text-amber-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {formError && formErrorType === '403' && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
              <span className="text-xs text-red-700 dark:text-red-300 flex-1">{formError}</span>
              <button onClick={onClose} className="text-red-400 hover:text-red-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {formError && (formErrorType === '500' || formErrorType === 'network') && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
              <span className="text-xs text-red-700 dark:text-red-300 flex-1">{formError}</span>
              <button onClick={handleSubmit} className="text-xs text-red-700 dark:text-red-300 underline hover:no-underline font-medium">
                Retry
              </button>
            </div>
          )}
          {formError && formErrorType === '404' && (
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
