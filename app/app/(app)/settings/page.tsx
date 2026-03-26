import PreferencesCard from '@/features/settings/components/PreferencesCard';
import ApiKeyCardSkeleton from '@/features/settings/components/ApiKeyCardSkeleton';
import { Suspense } from 'react';
import ApiKeysSectionClient from './ApiKeysSectionClient';
import SettingsTabsClient from './SettingsTabsClient';
import EmailAlertPreferencesSection from '@/features/email-alerts/components/EmailAlertPreferencesSection';
import { cookies } from 'next/headers';

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

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

/**
 * Build auth headers for server-side fetches by forwarding the session cookie
 * (Firebase __session cookie set by the client on login, if present).
 */
async function serverAuthHeaders(): Promise<Record<string, string>> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('__session')?.value;
  if (sessionToken) return { Authorization: `Bearer ${sessionToken}` };
  return {};
}

export default async function SettingsPage() {
  const authHeaders = await serverAuthHeaders();

  // Fetch preferences and API key status simultaneously
  const [preferencesResult] = await Promise.all([
    fetch(`${BASE_URL}/api/settings/preferences`, {
      cache: 'no-store',
      headers: authHeaders,
    }).then(async (res): Promise<{ preferences: Preferences; isDefaults: boolean }> => {
      // 401 or 404 are expected for unauthenticated / first-time users → use defaults
      if (res.status === 401 || res.status === 404 || !res.ok) {
        return { preferences: DEFAULT_PREFERENCES, isDefaults: true };
      }
      const data = await res.json();
      return {
        preferences: data?.preferences ?? DEFAULT_PREFERENCES,
        isDefaults: !data?.preferences,
      };
    }).catch(() => ({ preferences: DEFAULT_PREFERENCES, isDefaults: true })),

    // /api/keys/status is fetched with auth by ApiKeysSectionClient (client component).
    // We include a server-side attempt here purely for the parallel waterfall benefit —
    // the result is not consumed here (the client component is the source of truth).
    fetch(`${BASE_URL}/api/keys/status`, {
      cache: 'no-store',
      headers: authHeaders,
    }).catch(() => null),
  ]);

  const { preferences, isDefaults } = preferencesResult;

  return (
    <SettingsTabsClient>
      {/* API Key Cards — client component handles authed fetching and callbacks */}
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
