import PreferencesCard from '@/features/settings/components/PreferencesCard';
import PreferencesSkeleton from '@/features/settings/components/PreferencesSkeleton';
import ApiKeyCardSkeleton from '@/features/settings/components/ApiKeyCardSkeleton';
import { Suspense } from 'react';
import ApiKeysSectionClient from './ApiKeysSectionClient';

interface Preferences {
  timezone: string;
  currency: string;
  defaultDateRange: 'last_7_days' | 'last_14_days' | 'last_30_days' | 'this_month';
  notifications: {
    dailySummaryEmail: boolean;
    weeklyReportEmail: boolean;
  };
}

const DEFAULT_PREFERENCES: Preferences = {
  timezone: 'UTC',
  currency: 'USD',
  defaultDateRange: 'last_7_days',
  notifications: { dailySummaryEmail: false, weeklyReportEmail: false },
};

async function fetchPreferences(): Promise<{ preferences: Preferences; isDefaults: boolean }> {
  try {
    const [prefsRes] = await Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/settings/preferences`, {
        cache: 'no-store',
      }),
      // /api/keys/status fetched client-side in ApiKeysSectionClient
    ]);
    if (!prefsRes.ok) return { preferences: DEFAULT_PREFERENCES, isDefaults: true };
    const data = await prefsRes.json();
    return {
      preferences: data?.preferences ?? DEFAULT_PREFERENCES,
      isDefaults: !data?.preferences,
    };
  } catch {
    return { preferences: DEFAULT_PREFERENCES, isDefaults: true };
  }
}

export default async function SettingsPage() {
  const { preferences, isDefaults } = await fetchPreferences();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Manage your API keys, preferences, network configurations, and more.
        </p>
      </div>

      {/* API Key Cards — client component handles fetching and callbacks */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Network API Keys</h2>
        <Suspense fallback={
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <ApiKeyCardSkeleton key={i} />)}
          </div>
        }>
          <ApiKeysSectionClient />
        </Suspense>
      </section>

      {/* General Preferences — server-fetched initial data passed as props */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">General Preferences</h2>
        <PreferencesCard initialPreferences={preferences} isDefaults={isDefaults} />
      </section>
    </div>
  );
}
