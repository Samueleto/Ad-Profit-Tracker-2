// Step 124: TypeScript types for Zeydoo integration

import type { Timestamp } from 'firebase-admin/firestore';

export interface ZeydooAdStat {
  id: string;
  userId: string;
  networkId: string; // 'zeydoo'
  date: string; // YYYY-MM-DD
  country: string; // ISO code
  revenue: number;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  cost: null; // Zeydoo doesn't provide cost
  rawResponse: Record<string, unknown>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ZeydooApiKey {
  userId: string;
  networkId: string;
  encryptedKey: string;
  iv: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface DecryptedApiKey {
  key: string;
}

export interface ZeydooNetworkConfig {
  userId: string;
  networkId: string;
  isActive: boolean;
  syncSchedule: string;
  lastSyncedAt: Timestamp | null;
  lastSyncStatus: 'success' | 'failed' | 'pending' | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ZeydooAuditLog {
  userId: string;
  action: string;
  status: 'success' | 'failed';
  metadata: Record<string, unknown>;
  createdAt: Timestamp;
}

export interface DateRangeValidationResult {
  valid: boolean;
  error?: string;
}

export function validateDateRange(
  dateFrom: string,
  dateTo: string
): DateRangeValidationResult {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateFrom)) {
    return { valid: false, error: 'dateFrom must be in YYYY-MM-DD format' };
  }
  if (!dateRegex.test(dateTo)) {
    return { valid: false, error: 'dateTo must be in YYYY-MM-DD format' };
  }

  const from = new Date(dateFrom);
  const to = new Date(dateTo);

  if (isNaN(from.getTime())) {
    return { valid: false, error: 'dateFrom is not a valid date' };
  }
  if (isNaN(to.getTime())) {
    return { valid: false, error: 'dateTo is not a valid date' };
  }
  if (from > to) {
    return { valid: false, error: 'dateFrom must be before or equal to dateTo' };
  }

  const diffMs = to.getTime() - from.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays > 90) {
    return { valid: false, error: 'Date range cannot exceed 90 days' };
  }

  return { valid: true };
}
