// Step 130: TypeScript types for reconciliation

import type { Timestamp } from 'firebase-admin/firestore';

export interface AnomalyResolution {
  resolvedAt: Timestamp;
  resolution: string;
  note: string | null;
  resolvedBy: string; // uid
}

export interface AnomalyFlag {
  type: string;
  field: string;
  expectedRange: [number, number] | null;
  actualValue: unknown;
  severity: 'warning' | 'critical';
  resolution?: AnomalyResolution;
}

export interface AdStatsValidation {
  validationStatus: 'valid' | 'anomaly' | 'missing' | 'stale';
  validationCheckedAt: Timestamp;
  anomalyFlags: AnomalyFlag[];
  isReconciled: boolean;
  reconciledAt: Timestamp | null;
}

export interface NetworkConfigValidation {
  lastValidationStatus: 'clean' | 'anomalies_detected' | 'missing_data' | 'never_run';
  lastValidationAt: Timestamp | null;
  anomalyCount: number;
  validationRules: ValidationRules | null;
}

export interface ValidationRules {
  maxDailyRevenueUSD: number;
  minDailyRevenueUSD: number;
  maxDailyCostUSD: number;
  maxCtrPercent: number;
  minImpressions: number;
  allowNullCountry: boolean;
}

export const VALIDATION_SYSTEM_DEFAULTS: ValidationRules = {
  maxDailyRevenueUSD: 50000,
  minDailyRevenueUSD: 0,
  maxDailyCostUSD: 50000,
  maxCtrPercent: 50,
  minImpressions: 0,
  allowNullCountry: true,
};

export interface ReconciliationRunResult {
  networkId: string;
  dateFrom: string;
  dateTo: string;
  recordsChecked: number;
  anomaliesFound: number;
  anomalyFlags: AnomalyFlag[];
  ranAt: string;
}

export interface ReconciliationStatus {
  networkId: string;
  lastValidationStatus: string;
  lastValidationAt: string | null;
  anomalyCount: number;
  validationRules: ValidationRules;
}

export interface AnomalyListResponse {
  anomalies: Array<AnomalyFlag & { id: string; date: string; networkId: string }>;
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export interface ResolveResult {
  success: boolean;
  anomalyId: string;
  resolvedAt: string;
}

export interface RulesResponse {
  networkId: string;
  rules: ValidationRules;
  isCustom: boolean;
  updatedAt: string | null;
}
