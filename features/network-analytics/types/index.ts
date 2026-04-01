// Step 136: TypeScript types for network analytics

export type NetworkId = 'exoclick' | 'rollerads' | 'zeydoo' | 'propush';
export type DataRole = 'cost' | 'revenue';

export interface NetworkStatsSummary {
  primaryMetric: number;
  impressions: number;
  clicks: number;
  averageCtr: number;
  averageCpm: number;
  countryCount: number;
  daysWithData: number;
}

export interface NetworkStatsDailyPoint {
  date: string;
  primaryMetric: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
}

export interface NetworkStatsCountryRow {
  country: string;
  countryName: string;
  primaryMetric: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  metricShare: number;
}

export interface NetworkStatus {
  lastSyncedAt: string | null;
  lastSyncStatus: string;
  circuitBreakerOpen: boolean;
}

export interface NetworkStatsResponse {
  networkId: NetworkId;
  dataRole: DataRole;
  dateFrom: string;
  dateTo: string;
  groupBy: string;
  summary: NetworkStatsSummary;
  series?: NetworkStatsDailyPoint[];
  countries?: NetworkStatsCountryRow[];
  networkStatus: NetworkStatus;
  cachedAt: string | null;
}

export interface NetworkAnalyticsAdStatDocument {
  userId: string;
  networkId: string;
  date: string;
  country: string;
  impressions?: number;
  clicks?: number;
  cost?: number;
  revenue?: number;
  ctr: number;
  cpm: number;
}

export interface NetworkAnalyticsConfigDocument {
  userId: string;
  networkId: string;
  lastSyncedAt: string | null;
  lastSyncStatus: string;
  circuitBreakerOpen: boolean;
}
