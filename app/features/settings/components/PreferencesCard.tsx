'use client';

import { useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { usePreferences, type Preferences } from '../hooks/usePreferences';
import { Toast } from '@/components/ui/Toast';

interface PreferencesCardProps {
  initialPreferences: Preferences;
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

export default function PreferencesCard({ initialPreferences, isDefaults = false }: PreferencesCardProps) {
  const { prefs, saveStatus, error, updatePreference, saveAll } = usePreferences(initialPreferences);

  const [tzSearch, setTzSearch] = useState(initialPreferences.timezone);
  const [tzOpen, setTzOpen] = useState(false);

  const saving = saveStatus === 'saving';

  const filteredTimezones = ALL_TIMEZONES.filter(tz =>
    tz.toLowerCase().includes(tzSearch.toLowerCase())
  ).slice(0, 50);

  const handleTimezoneSelect = (tz: string) => {
    setTzSearch(tz);
    setTzOpen(false);
    updatePreference('timezone', tz);
  };

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

      {/* Error banner */}
      {saveStatus === 'error' && error && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={saveAll} className="ml-auto text-xs underline">Retry</button>
        </div>
      )}

      {/* Success toast (fixed-position) */}
      {saveStatus === 'success' && (
        <Toast message="Preferences saved" variant="success" />
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
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Currency</label>
          <select
            value={prefs.currency}
            onChange={e => updatePreference('currency', e.target.value)}
            disabled={saving}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white disabled:opacity-50"
          >
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Default date range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Default Date Range</label>
          <select
            value={prefs.defaultDateRange}
            onChange={e => updatePreference('defaultDateRange', e.target.value as Preferences['defaultDateRange'])}
            disabled={saving}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white disabled:opacity-50"
          >
            {DATE_RANGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
              onChange={v => updatePreference('notifications', { ...prefs.notifications, dailySummaryEmail: v })}
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
              onChange={v => updatePreference('notifications', { ...prefs.notifications, weeklyReportEmail: v })}
              disabled={saving}
            />
          </div>
        </div>

        {/* Save all button */}
        <button
          onClick={saveAll}
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
