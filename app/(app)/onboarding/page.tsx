'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth } from 'firebase/auth';
import StepProgressBar from '@/features/onboarding/components/StepProgressBar';
import WelcomeStep from '@/features/onboarding/components/WelcomeStep';
import ProfileSetupStep from '@/features/onboarding/components/ProfileSetupStep';
import ApiKeysTeaserStep from '@/features/onboarding/components/ApiKeysTeaserStep';
import DoneStep from '@/features/onboarding/components/DoneStep';
import type { OnboardingFormValues } from '@/features/onboarding/types';

const TOTAL_STEPS = 4;

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

  useEffect(() => {
    const load = async () => {
      try {
        const res = await authFetch('/api/auth/get-user');
        if (res.ok) {
          const data = await res.json();
          const name = data?.user?.displayName ?? getAuth().currentUser?.displayName ?? '';
          setDisplayName(name);
          setFormDefaults({
            displayName: name,
            timezone: data?.user?.preferences?.timezone ?? 'UTC',
            defaultDateRange: data?.user?.preferences?.defaultDateRange ?? 'last7days',
          });
          // If user has already completed onboarding, set cookie and redirect away
          if (data?.user?.onboardingCompletedAt) {
            document.cookie = 'ob_done=1; path=/; max-age=31536000; SameSite=Lax';
            router.replace('/dashboard');
            return;
          }
        } else {
          const name = getAuth().currentUser?.displayName ?? '';
          setDisplayName(name);
          setFormDefaults(prev => ({ ...prev, displayName: name }));
        }
      } catch {
        const name = getAuth().currentUser?.displayName ?? '';
        setDisplayName(name);
        setFormDefaults(prev => ({ ...prev, displayName: name }));
      } finally {
        setProfileLoading(false);
      }
    };
    load();
  }, []);

  const handleProfileSubmit = async (values: OnboardingFormValues) => {
    setSubmitting(true);
    try {
      await authFetch('/api/auth/update-profile', {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: values.displayName,
          preferences: {
            timezone: values.timezone,
            defaultDateRange: values.defaultDateRange,
          },
        }),
      });
      setFormDefaults(values);
      setStep(3);
    } finally {
      setSubmitting(false);
    }
  };

  const markComplete = async (skippedParam = false) => {
    const res = await authFetch('/api/auth/update-profile', {
      method: 'PATCH',
      body: JSON.stringify({
        onboardingCompletedAt: 'serverTimestamp',
        ...(skippedParam ? { onboardingSkipped: true } : {}),
      }),
    });
    if (!res.ok) throw new Error('Failed to complete onboarding.');
    // Set cookie so middleware allows through to protected routes
    document.cookie = 'ob_done=1; path=/; max-age=31536000; SameSite=Lax';
  };

  const handleGoToSettings = async () => {
    setNavigating(true);
    try {
      await markComplete(skipped);
      router.push('/settings');
    } catch {
      setNavigating(false);
    }
  };

  const handleSkip = () => {
    setSkipped(true);
    setStep(4);
  };

  const handleGoToDashboard = async () => {
    setNavigating(true);
    try {
      await markComplete(skipped);
      router.replace('/dashboard');
    } catch {
      setNavigating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8">
        <StepProgressBar currentStep={step} totalSteps={TOTAL_STEPS} />

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
          <DoneStep onGoToDashboard={handleGoToDashboard} isLoading={navigating} />
        )}
      </div>
    </div>
  );
}
