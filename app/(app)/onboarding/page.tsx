'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth } from 'firebase/auth';
import { toast } from 'sonner';
import { AlertCircle, ShieldAlert } from 'lucide-react';
import StepProgressBar from '@/features/onboarding/components/StepProgressBar';
import WelcomeStep from '@/features/onboarding/components/WelcomeStep';
import ProfileSetupStep from '@/features/onboarding/components/ProfileSetupStep';
import ApiKeysTeaserStep from '@/features/onboarding/components/ApiKeysTeaserStep';
import DoneStep from '@/features/onboarding/components/DoneStep';
import type { OnboardingFormValues } from '@/features/onboarding/types';

const TOTAL_STEPS = 4;

// Returns { res, sessionExpired } or throws TypeError on network error
async function authFetch(path: string, init: RequestInit = {}): Promise<{ res: Response; sessionExpired: boolean }> {
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(path, { ...init, headers });
  if (res.status !== 401) return { res, sessionExpired: false };

  // Force-refresh and retry exactly once
  const freshToken = await auth.currentUser?.getIdToken(true).catch(() => null);
  if (!freshToken) return { res, sessionExpired: true };
  const retryRes = await fetch(path, {
    ...init,
    headers: { ...headers, Authorization: `Bearer ${freshToken}` },
  });
  return { res: retryRes, sessionExpired: retryRes.status === 401 };
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [profileLoading, setProfileLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [formDefaults, setFormDefaults] = useState<OnboardingFormValues>({
    displayName: '',
    timezone: 'UTC',
    defaultDateRange: 'last7days',
  });
  const [submitting, setSubmitting] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [navigating, setNavigating] = useState(false);

  // Error states
  const [accessDenied, setAccessDenied] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [completeError, setCompleteError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    setCardError(null);
    try {
      const { res, sessionExpired } = await authFetch('/api/auth/get-user');
      if (sessionExpired) {
        toast.error('Session expired. Please sign in again.');
        router.replace('/');
        return;
      }
      if (res.status === 403) { setAccessDenied(true); return; }
      if (res.status === 404) {
        // Silently sync user document and retry once
        try {
          await authFetch('/api/auth/sync-user', { method: 'POST' });
          const { res: retryRes, sessionExpired: retryExpired } = await authFetch('/api/auth/get-user');
          if (retryExpired) {
            toast.error('Session expired. Please sign in again.');
            router.replace('/');
            return;
          }
          if (retryRes.ok) {
            const data = await retryRes.json();
            const name = data?.user?.displayName ?? getAuth().currentUser?.displayName ?? '';
            setDisplayName(name);
            setFormDefaults({
              displayName: name,
              timezone: data?.user?.preferences?.timezone ?? 'UTC',
              defaultDateRange: data?.user?.preferences?.defaultDateRange ?? 'last7days',
            });
            if (data?.user?.onboardingCompletedAt) {
              document.cookie = 'ob_done=1; path=/; max-age=31536000; SameSite=Lax';
              router.replace('/dashboard');
            }
            return;
          }
        } catch {
          // fall through to error state
        }
        setCardError('Something went wrong. Please try again.');
        return;
      }
      if (!res.ok) {
        setCardError('Something went wrong. Please try again.');
        return;
      }
      const data = await res.json();
      const name = data?.user?.displayName ?? getAuth().currentUser?.displayName ?? '';
      setDisplayName(name);
      setFormDefaults({
        displayName: name,
        timezone: data?.user?.preferences?.timezone ?? 'UTC',
        defaultDateRange: data?.user?.preferences?.defaultDateRange ?? 'last7days',
      });
      if (data?.user?.onboardingCompletedAt) {
        document.cookie = 'ob_done=1; path=/; max-age=31536000; SameSite=Lax';
        router.replace('/dashboard');
      }
    } catch {
      // Network error
      setCardError('Check your internet connection and try again.');
    } finally {
      setProfileLoading(false);
    }
  }, [router]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const handleProfileSubmit = async (values: OnboardingFormValues) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { res, sessionExpired } = await authFetch('/api/auth/update-profile', {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: values.displayName,
          preferences: {
            timezone: values.timezone,
            defaultDateRange: values.defaultDateRange,
          },
        }),
      });
      if (sessionExpired) {
        toast.error('Session expired. Please sign in again.');
        router.replace('/');
        return;
      }
      if (res.status === 403) { setAccessDenied(true); return; }
      if (!res.ok) {
        setSubmitError('Something went wrong. Please try again.');
        return;
      }
      setFormDefaults(values);
      setStep(3);
    } catch {
      setSubmitError('Check your internet connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const markComplete = async (skippedParam = false) => {
    const { res, sessionExpired } = await authFetch('/api/auth/update-profile', {
      method: 'PATCH',
      body: JSON.stringify({
        onboardingCompletedAt: 'serverTimestamp',
        ...(skippedParam ? { onboardingSkipped: true } : {}),
      }),
    });
    if (sessionExpired) {
      toast.error('Session expired. Please sign in again.');
      router.replace('/');
      throw new Error('session_expired');
    }
    if (!res.ok) throw new Error('Failed to complete onboarding.');
    document.cookie = 'ob_done=1; path=/; max-age=31536000; SameSite=Lax';
  };

  const handleGoToSettings = async () => {
    setNavigating(true);
    setCompleteError(null);
    try {
      await markComplete(skipped);
      router.push('/settings');
    } catch (err) {
      if (err instanceof Error && err.message === 'session_expired') return;
      setCompleteError('Something went wrong. Please try again.');
      setNavigating(false);
    }
  };

  const handleSkip = () => {
    setSkipped(true);
    setStep(4);
  };

  const handleGoToDashboard = async () => {
    setNavigating(true);
    setCompleteError(null);
    try {
      await markComplete(skipped);
      router.replace('/dashboard');
    } catch (err) {
      if (err instanceof Error && err.message === 'session_expired') return;
      setCompleteError('Something went wrong. Please try again.');
      setNavigating(false);
    }
  };

  if (accessDenied) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
        <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <ShieldAlert className="w-10 h-10 text-red-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Access Denied</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">You don&apos;t have permission to access this page.</p>
            <a href="/dashboard" className="text-sm text-blue-600 underline hover:no-underline">Go to Dashboard</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8">
        <StepProgressBar currentStep={step} totalSteps={TOTAL_STEPS} />

        {/* Inline card error banner (non-step-specific errors) */}
        {cardError && (
          <div className="mb-4 flex items-center justify-between px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <span className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {cardError}
            </span>
            <button
              onClick={loadProfile}
              className="text-xs text-red-700 dark:text-red-400 underline hover:no-underline ml-3"
            >
              Retry
            </button>
          </div>
        )}

        {/* Step 1 */}
        {step === 1 && (
          <>
            {profileLoading ? (
              <div className="space-y-4 animate-pulse text-center">
                <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-2xl mx-auto" />
                <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mx-auto" />
                <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-full" />
                <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-5/6 mx-auto" />
                <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg mt-4" />
              </div>
            ) : (
              <WelcomeStep displayName={displayName} onNext={() => setStep(2)} />
            )}
          </>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="space-y-4">
            {submitError && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                <span className="text-xs text-red-700 dark:text-red-400">{submitError}</span>
              </div>
            )}
            <ProfileSetupStep
              defaultValues={formDefaults}
              onSubmit={handleProfileSubmit}
              isSubmitting={submitting}
            />
            <button
              onClick={() => setStep(1)}
              disabled={submitting}
              className="w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
            >
              ← Back
            </button>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="space-y-4">
            <ApiKeysTeaserStep
              onGoToSettings={handleGoToSettings}
              onSkip={handleSkip}
            />
            <button
              onClick={() => setStep(2)}
              className="w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              ← Back
            </button>
          </div>
        )}

        {/* Step 4 */}
        {step === 4 && (
          <div className="space-y-3">
            {completeError && (
              <div className="flex items-center justify-between px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                <span className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {completeError}
                </span>
                <button
                  onClick={handleGoToDashboard}
                  className="text-xs text-red-700 dark:text-red-400 underline hover:no-underline ml-3"
                >
                  Retry
                </button>
              </div>
            )}
            <DoneStep onGoToDashboard={handleGoToDashboard} isLoading={navigating} />
          </div>
        )}
      </div>
    </div>
  );
}
