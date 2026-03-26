'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth } from 'firebase/auth';
import { Loader2, AlertTriangle } from 'lucide-react';

type DateRangeOption = 'last_7_days' | 'last_14_days' | 'last_30_days' | 'this_month';

interface Preferences {
  timezone: string;
  currency: string;
  defaultDateRange: DateRangeOption;
  notifications: {
    dailySummaryEmail: boolean;
    weeklyReportEmail: boolean;
  };
}

interface PreferencesCardProps {
  initialPreferences: Preferences;
  isDefaults?: boolean;
}

const CURRENCIES = [
  'USD','EUR','GBP','JPY','CAD','AUD','CHF','CNY','INR','MXN',
  'BRL','SGD','HKD','NOK','SEK','DKK','NZD','ZAR','KRW','AED',
];

const DATE_RANGE_OPTIONS: { label: string; value: DateRangeOption }[] = [
  { label: 'Last 7 days', value: 'last_7_days' },
  { label: 'Last 14 days', value: 'last_14_days' },
  { label: 'Last 30 days', value: 'last_30_days' },
  { label: 'This month', value: 'this_month' },
];

// Common IANA timezones for filtering
const ALL_TIMEZONES: string[] = typeof Intl !== 'undefined' && typeof (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf === 'function'
  ? (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf('timeZone')
  : [
    'UTC','America/New_York','America/Chicago','America/Denver','America/Los_Angeles',
    'America/Toronto','America/Vancouver','Europe/London','Europe/Paris','Europe/Berlin',
    'Europe/Amsterdam','Europe/Rome','Europe/Madrid','Europe/Moscow','Asia/Dubai',
    'Asia/Kolkata','Asia/Bangkok','Asia/Singapore','Asia/Shanghai','Asia/Tokyo',
    'Asia/Seoul','Australia/Sydney','Pacific/Auckland',
  ];

async function getToken(forceRefresh = false): Promise<string | null> {
  const auth = getAuth();
  return auth.currentUser?.getIdToken(forceRefresh) ?? null;
}

async function patchPreferences(partial: Partial<Preferences & { 'notifications.dailySummaryEmail': boolean; 'notifications.weeklyReportEmail': boolean }>, token: string): Promise<Response> {
  return fetch('/api/settings/preferences', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(partial),
  });
}

// Toggle switch component
function Toggle({ checked, onChange, disabled, id }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; id: string }) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
        checked ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export default function PreferencesCard({ initialPreferences, isDefaults = false }: PreferencesCardProps) {
  const router = useRouter();
  const [prefs, setPrefs] = useState<Preferences>(initialPreferences);
  const [tzSearch, setTzSearch] = useState(initialPreferences.timezone);
  const [tzOpen, setTzOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<'forbidden' | '500' | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const filteredTimezones = ALL_TIMEZONES.filter(tz =>
    tz.toLowerCase().includes(tzSearch.toLowerCase())
  ).slice(0, 50);

  const doSave = async (partial: Partial<Preferences>) => {
    setSaving(true);
    setError(null);
    try {
      let token = await getToken();
      if (!token) { router.push('/'); return; }

      let res = await patchPreferences(partial as Parameters<typeof patchPreferences>[0], token);

      if (res.status === 401) {
        token = await getToken(true);
        if (!token) { router.push('/'); return; }
        res = await patchPreferences(partial as Parameters<typeof patchPreferences>[0], token);
      }

      if (res.status === 401) {
        router.push('/');
        return;
      }
      if (res.status === 403) { setError('forbidden'); return; }
      if (res.status >= 500) { setError('500'); return; }

      showToast('Preferences saved');
    } catch {
      setError('500');
    } finally {
      setSaving(false);
    }
  };

  const scheduleAutoSave = (partial: Partial<Preferences>) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => doSave(partial), 600);
  };

  const handleTimezoneSelect = (tz: string) => {
    setTzSearch(tz);
    setTzOpen(false);
    const updated = { ...prefs, timezone: tz };
    setPrefs(updated);
    doSave({ timezone: tz });
  };

  const handleCurrencyChange = (currency: string) => {
    const updated = { ...prefs, currency };
    setPrefs(updated);
    scheduleAutoSave({ currency });
  };

  const handleDateRangeChange = (defaultDateRange: DateRangeOption) => {
    const updated = { ...prefs, defaultDateRange };
    setPrefs(updated);
    scheduleAutoSave({ defaultDateRange });
  };

  const handleNotificationChange = (key: 'dailySummaryEmail' | 'weeklyReportEmail', value: boolean) => {
    const updated = { ...prefs, notifications: { ...prefs.notifications, [key]: value } };
    setPrefs(updated);
    scheduleAutoSave(updated);
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">General Preferences</h2>
        {isDefaults && (
          <span className="text-xs text-gray-400 dark:text-gray-500">Defaults applied</span>
        )}
      </div>
      <hr className="border-gray-200 dark:border-gray-700 mb-5" />

      {/* Error banners */}
      {error === 'forbidden' && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Access Denied.{' '}
          <a href="/dashboard" className="underline">Go to Dashboard</a>
        </div>
      )}
      {error === '500' && (
        <div className="mb-4 flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            Failed to save preferences.
          </span>
          <button
            onClick={() => doSave(prefs)}
            className="text-xs underline"
          >
            Retry
          </button>
        </div>
      )}

      <div className="space-y-5">
        {/* Timezone searchable combobox */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Timezone
          </label>
          <div className="relative">
            <input
              type="text"
              value={tzSearch}
              onChange={e => { setTzSearch(e.target.value); setTzOpen(true); }}
              onFocus={() => setTzOpen(true)}
              onBlur={() => setTimeout(() => setTzOpen(false), 150)}
              disabled={saving}
              placeholder="Search timezones…"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white disabled:opacity-50"
            />
            {tzOpen && filteredTimezones.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full max-h-48 overflow-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg text-sm">
                {filteredTimezones.map(tz => (
                  <li
                    key={tz}
                    onMouseDown={() => handleTimezoneSelect(tz)}
                    className={`px-3 py-2 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 ${
                      tz === prefs.timezone ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {tz}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Currency */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Display Currency
          </label>
          <select
            value={prefs.currency}
            onChange={e => handleCurrencyChange(e.target.value)}
            disabled={saving}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white disabled:opacity-50"
          >
            {CURRENCIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Default date range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Default Date Range
          </label>
          <select
            value={prefs.defaultDateRange}
            onChange={e => handleDateRangeChange(e.target.value as DateRangeOption)}
            disabled={saving}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white disabled:opacity-50"
          >
            {DATE_RANGE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Notifications */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Notifications</p>
          <div className="flex items-center justify-between">
            <label htmlFor="toggle-daily" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              Daily summary email
            </label>
            <Toggle
              id="toggle-daily"
              checked={prefs.notifications.dailySummaryEmail}
              onChange={v => handleNotificationChange('dailySummaryEmail', v)}
              disabled={saving}
            />
          </div>
          <div className="flex items-center justify-between">
            <label htmlFor="toggle-weekly" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              Weekly report email
            </label>
            <Toggle
              id="toggle-weekly"
              checked={prefs.notifications.weeklyReportEmail}
              onChange={v => handleNotificationChange('weeklyReportEmail', v)}
              disabled={saving}
            />
          </div>
        </div>

        {/* Save button */}
        <button
          onClick={() => doSave(prefs)}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Preferences
        </button>
      </div>
    </div>
  );
}
