// Step 143: TypeScript types for report builder

import type { Timestamp } from 'firebase-admin/firestore';

export const ALLOWED_METRICS = ['revenue', 'cost', 'netProfit', 'roi', 'impressions', 'clicks', 'ctr', 'cpm'] as const;
export const ALLOWED_NETWORKS = ['exoclick', 'rollerads', 'zeydoo', 'propush'] as const;
export const ALLOWED_GROUPBY = ['daily', 'country', 'network'] as const;
export const ALLOWED_DATA_QUALITY = ['all', 'anomalies', 'clean'] as const;
export const ALLOWED_DATE_PRESETS = ['last_7', 'last_14', 'last_30', 'last_90', 'this_month', 'custom'] as const;

export type ReportMetric = typeof ALLOWED_METRICS[number];
export type ReportNetwork = typeof ALLOWED_NETWORKS[number];
export type ReportGroupBy = typeof ALLOWED_GROUPBY[number];
export type ReportDataQuality = typeof ALLOWED_DATA_QUALITY[number];
export type ReportDatePreset = typeof ALLOWED_DATE_PRESETS[number];

export interface SavedReport {
  id: string;
  name: string;
  metrics: string[];
  networks: string[];
  countries: string[];
  groupBy: string;
  dataQuality: string;
  dateRangePreset: string;
  dateFrom: string | null;
  dateTo: string | null;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}

export interface ReportConfig {
  metrics: string[];
  networks: string[];
  countries: string[];
  groupBy: string;
  dataQuality: string;
  dateRangePreset: string;
  dateFrom: string | null;
  dateTo: string | null;
}

export interface ReportRunRow {
  key: string;
  label: string;
  revenue?: number;
  cost?: number;
  netProfit?: number;
  roi?: number;
  impressions?: number;
  clicks?: number;
  ctr?: number;
  cpm?: number;
}

export interface ReportRunSummary {
  revenue?: number;
  cost?: number;
  netProfit?: number;
  roi?: number;
  impressions?: number;
  clicks?: number;
  ctr?: number;
  cpm?: number;
  totalRows: number;
}

export interface ReportRunResponse {
  dateFrom: string;
  dateTo: string;
  config: ReportConfig;
  rows: ReportRunRow[];
  summary: ReportRunSummary;
  hasMore: boolean;
  nextCursor: string | null;
  cachedAt: string | null;
}

export interface SavedReportsListResponse {
  reports: SavedReport[];
  total: number;
}
