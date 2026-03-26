import PreferencesCard from '@/features/settings/components/PreferencesCard';
import ApiKeyCardSkeleton from '@/features/settings/components/ApiKeyCardSkeleton';
import { Suspense } from 'react';
import ApiKeysSectionClient from './ApiKeysSectionClient';
import SettingsTabsClient from './SettingsTabsClient';
import EmailAlertPreferencesSection from '@/features/email-alerts/components/EmailAlertPreferencesSection';

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
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/settings/preferences`,
      { cache: 'no-store' }
    );
    if (!res.ok) return { preferences: DEFAULT_PREFERENCES, isDefaults: true };
    const data = await res.json();
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
    <SettingsTabsClient>
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

      {/* Email Alert Preferences */}
      <section>
        <EmailAlertPreferencesSection />
      </section>
    </SettingsTabsClient>
  );
}
