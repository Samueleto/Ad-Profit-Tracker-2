import { FieldValue } from "firebase-admin/firestore";

export interface UserPreferences {
  timezone: string;
  currency: string;
  defaultDateRange: "last_7_days" | "last_14_days" | "last_30_days" | "this_month";
  notifications: {
    dailySummaryEmail: boolean;
    weeklyReportEmail: boolean;
  };
  updatedAt: FirebaseFirestore.Timestamp | null;
}

export const DEFAULT_PREFERENCES: Omit<UserPreferences, "updatedAt"> & { updatedAt: null } = {
  timezone: "UTC",
  currency: "USD",
  defaultDateRange: "last_7_days",
  notifications: {
    dailySummaryEmail: false,
    weeklyReportEmail: false,
  },
  updatedAt: null,
};

const VALID_DATE_RANGES = ["last_7_days", "last_14_days", "last_30_days", "this_month"] as const;

const VALID_CURRENCIES = [
  "USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY", "INR", "MXN",
  "BRL", "SGD", "HKD", "NOK", "SEK", "DKK", "NZD", "ZAR", "KRW", "AED",
];

export function isValidTimezone(tz: string): boolean {
  try {
    if (typeof Intl.supportedValuesOf === "function") {
      return Intl.supportedValuesOf("timeZone").includes(tz);
    }
    // Fallback: try to create a formatter
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function isValidCurrency(currency: string): boolean {
  return VALID_CURRENCIES.includes(currency.toUpperCase());
}

export function isValidDateRange(range: string): range is UserPreferences["defaultDateRange"] {
  return (VALID_DATE_RANGES as readonly string[]).includes(range);
}

/**
 * Builds a Firestore dot-notation update object for preferences.
 * This safely merges only the provided fields without overwriting others.
 */
export function buildPreferencesUpdateObject(
  patch: Partial<Omit<UserPreferences, "updatedAt">>
): Record<string, unknown> {
  const updateObj: Record<string, unknown> = {
    "preferences.updatedAt": FieldValue.serverTimestamp(),
  };

  if (patch.timezone !== undefined) {
    updateObj["preferences.timezone"] = patch.timezone;
  }
  if (patch.currency !== undefined) {
    updateObj["preferences.currency"] = patch.currency;
  }
  if (patch.defaultDateRange !== undefined) {
    updateObj["preferences.defaultDateRange"] = patch.defaultDateRange;
  }
  if (patch.notifications !== undefined) {
    if (patch.notifications.dailySummaryEmail !== undefined) {
      updateObj["preferences.notifications.dailySummaryEmail"] = patch.notifications.dailySummaryEmail;
    }
    if (patch.notifications.weeklyReportEmail !== undefined) {
      updateObj["preferences.notifications.weeklyReportEmail"] = patch.notifications.weeklyReportEmail;
    }
  }

  return updateObj;
}
