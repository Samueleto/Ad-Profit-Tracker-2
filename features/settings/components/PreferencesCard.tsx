'use client';

import { useState, useEffect } from 'react';
import { Loader2, AlertTriangle, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { usePreferences, type Preferences } from '../hooks/usePreferences';
import { toast } from 'sonner';
import PreferencesSkeleton from './PreferencesSkeleton';

interface PreferencesCardProps {
  initialPreferences: Preferences | null;
  isDefaults?: boolean;
}

const CURRENCIES = [
  'USD','EUR','GBP','JPY','CAD','AUD','CHF','CNY','INR','MXN',
  'BRL','SGD','HKD','NOK','SEK','DKK','NZD','ZAR','KRW','AED',
];

const DATE_RANGE_OPTIONS: { label: string; value: Preferences['defaultDateRange'] }[] = [
  { label: 'Last 7 days', value: 'last_7_days' },
  { label: 'Last 14 days', value: 'last_14_days' },
  { label: 'Last 30 days', value: 'last_30_days' },
  { label: 'This month', value: 'this_month' },
];

const ALL_TIMEZONES: string[] =
  typeof Intl !== 'undefined' &&
  typeof (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf === 'function'
    ? (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf('timeZone')
    : [
        'UTC','America/New_York','America/Chicago','America/Denver','America/Los_Angeles',
        'America/Toronto','Europe/London','Europe/Paris','Europe/Berlin','Asia/Dubai',
        'Asia/Kolkata','Asia/Bangkok','Asia/Singapore','Asia/Tokyo','Australia/Sydney',
      ];

function Toggle({ checked, onChange, disabled, id }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  id: string;
}) {
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

export default function PreferencesCard({ initialPreferences, isDefaults: initialIsDefaults = false }: PreferencesCardProps) {
  const {
    prefs,
    loadState,
    isDefaults,
    saveStatus,
    fieldErrors,
    isRateLimited,
    updatePreference,
    saveAll,
    fetchPreferences,
  } = usePreferences(initialPreferences, initialIsDefaults);

  const [tzSearch, setTzSearch] = useState(initialPreferences?.timezone ?? 'UTC');
  const [tzOpen, setTzOpen] = useState(false);

  // Sync timezone search display when prefs load via client-side fetch
  useEffect(() => {
    if (loadState === 'loaded') setTzSearch(prefs.timezone);
  }, [loadState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show success toast when preferences are saved
  useEffect(() => {
    if (saveStatus === 'success') toast.success('Preferences saved');
  }, [saveStatus]);

  const saving = saveStatus === 'saving';
  const disabled = saving || isRateLimited;

  const filteredTimezones = ALL_TIMEZONES.filter(tz =>
    tz.toLowerCase().includes(tzSearch.toLowerCase())
  ).slice(0, 50);

  const handleTimezoneSelect = (tz: string) => {
    setTzSearch(tz);
    setTzOpen(false);
    updatePreference('timezone', tz);
  };

  // ─── Loading state ────────────────────────────────────────────────────────

  if (loadState === 'loading') {
    return <PreferencesSkeleton />;
  }

  // ─── 403 Access Denied ────────────────────────────────────────────────────

  if (loadState === 'error_403') {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">General Preferences</h2>
        <hr className="border-gray-200 dark:border-gray-700 mb-5" />
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <ShieldAlert className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-700 dark:text-red-400">Access Denied</p>
            <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">You don&apos;t have permission to manage preferences.</p>
          </div>
          <Link href="/dashboard" className="text-xs text-blue-600 dark:text-blue-400 underline whitespace-nowrap">
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // ─── 500 / Network error on GET ───────────────────────────────────────────

  if (loadState === 'error_500') {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">General Preferences</h2>
        <hr className="border-gray-200 dark:border-gray-700 mb-5" />
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700 dark:text-red-400 flex-1">Failed to load preferences.</span>
          <button
            onClick={fetchPreferences}
            className="text-xs text-red-700 dark:text-red-400 underline whitespace-nowrap"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ─── Loaded ───────────────────────────────────────────────────────────────

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">General Preferences</h2>
        {isDefaults && (
          <span className="text-xs text-gray-400 dark:text-gray-500">Defaults applied</span>
        )}
      </div>
      <hr className="border-gray-200 dark:border-gray-700 mb-5" />

      {/* General 400 validation error (not field-specific) */}
      {fieldErrors['_general'] && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {fieldErrors['_general']}
        </div>
      )}

      <div className="space-y-5">
        {/* Timezone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Timezone</label>
          <div className="relative">
            <input
              type="text"
              value={tzSearch}
              onChange={e => { setTzSearch(e.target.value); setTzOpen(true); updatePreference('timezone', e.target.value); }}
              onFocus={() => setTzOpen(true)}
              onBlur={() => setTimeout(() => setTzOpen(false), 150)}
              disabled={disabled}
              placeholder="Search timezones…"
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white disabled:opacity-50 ${
                fieldErrors['timezone'] ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
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
          {fieldErrors['timezone'] && (
            <p className="mt-1 text-xs text-red-500 dark:text-red-400">{fieldErrors['timezone']}</p>
          )}
        </div>

        {/* Currency */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Currency</label>
          <select
            value={prefs.currency}
            onChange={e => updatePreference('currency', e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white disabled:opacity-50"
          >
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {fieldErrors['currency'] && (
            <p className="mt-1 text-xs text-red-500 dark:text-red-400">{fieldErrors['currency']}</p>
          )}
        </div>

        {/* Default date range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Default Date Range</label>
          <select
            value={prefs.defaultDateRange}
            onChange={e => updatePreference('defaultDateRange', e.target.value as Preferences['defaultDateRange'])}
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white disabled:opacity-50"
          >
            {DATE_RANGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {fieldErrors['defaultDateRange'] && (
            <p className="mt-1 text-xs text-red-500 dark:text-red-400">{fieldErrors['defaultDateRange']}</p>
          )}
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
              onChange={v => updatePreference('notifications', { ...prefs.notifications, dailySummaryEmail: v })}
              disabled={disabled}
            />
          </div>
          <div className="flex items-center justify-between">
            <label htmlFor="toggle-weekly" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              Weekly report email
            </label>
            <Toggle
              id="toggle-weekly"
              checked={prefs.notifications.weeklyReportEmail}
              onChange={v => updatePreference('notifications', { ...prefs.notifications, weeklyReportEmail: v })}
              disabled={disabled}
            />
          </div>
        </div>

        {/* Save all button */}
        <button
          onClick={saveAll}
          disabled={disabled}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Preferences
        </button>
      </div>

    </div>
  );
}
