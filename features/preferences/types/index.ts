// Step 119: Preferences types and validation helpers

import type { Timestamp } from 'firebase/firestore';
import { serverTimestamp, FieldValue } from 'firebase/firestore';

export type DefaultDateRangeValue = 'last_7_days' | 'last_14_days' | 'last_30_days' | 'this_month';

export interface UserPreferences {
  timezone: string;
  currency: string;
  defaultDateRange: DefaultDateRangeValue;
  notifications: {
    dailySummaryEmail: boolean;
    weeklyReportEmail: boolean;
  };
  updatedAt: Timestamp | null;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  timezone: 'UTC',
  currency: 'USD',
  defaultDateRange: 'last_7_days',
  notifications: {
    dailySummaryEmail: false,
    weeklyReportEmail: false,
  },
  updatedAt: null,
};

const VALID_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'MXN',
  'BRL', 'SGD', 'HKD', 'NOK', 'SEK', 'DKK', 'NZD', 'ZAR', 'KRW', 'AED',
];

const VALID_DATE_RANGES: DefaultDateRangeValue[] = [
  'last_7_days', 'last_14_days', 'last_30_days', 'this_month',
];

export function isValidTimezone(tz: string): boolean {
  try {
    if (typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl) {
      const supported = (Intl as { supportedValuesOf: (key: string) => string[] }).supportedValuesOf('timeZone');
      return supported.includes(tz);
    }
    // Fallback: try constructing a DateTimeFormat
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function isValidCurrency(code: string): boolean {
  return VALID_CURRENCIES.includes(code.toUpperCase());
}

export function isValidDateRange(value: string): value is DefaultDateRangeValue {
  return (VALID_DATE_RANGES as string[]).includes(value);
}

export function buildPreferencesUpdateObject(
  patch: Partial<UserPreferences>
): Record<string, unknown> {
  const update: Record<string, unknown> = {};

  if (patch.timezone !== undefined) {
    update['preferences.timezone'] = patch.timezone;
  }
  if (patch.currency !== undefined) {
    update['preferences.currency'] = patch.currency;
  }
  if (patch.defaultDateRange !== undefined) {
    update['preferences.defaultDateRange'] = patch.defaultDateRange;
  }
  if (patch.notifications !== undefined) {
    if (patch.notifications.dailySummaryEmail !== undefined) {
      update['preferences.notifications.dailySummaryEmail'] = patch.notifications.dailySummaryEmail;
    }
    if (patch.notifications.weeklyReportEmail !== undefined) {
      update['preferences.notifications.weeklyReportEmail'] = patch.notifications.weeklyReportEmail;
    }
  }

  // Always update the updatedAt timestamp
  update['preferences.updatedAt'] = serverTimestamp();

  return update;
}
