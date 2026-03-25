// Step 137: TypeScript types for comparative network analysis

export type ComparisonMetric = 'revenue' | 'cost' | 'roi' | 'impressions' | 'clicks' | 'ctr' | 'cpm';

export interface NetworkComparisonItemStatus {
  lastSyncedAt: string | null;
  lastSyncStatus: string;
  circuitBreakerOpen: boolean;
}

export interface NetworkComparisonItem {
  networkId: string;
  dataRole: 'cost' | 'revenue';
  primaryMetric: number;
  impressions: number;
  clicks: number;
  averageCtr: number;
  averageCpm: number;
  daysWithData: number;
  metricShare: number;
  rank: number;
  networkStatus: NetworkComparisonItemStatus;
}

export interface CrossNetworkMetrics {
  totalRevenue: number;
  totalCost: number;
  netProfit: number;
  overallRoi: number | null;
  revenuePerImpression: number | null;
  costPerClick: number | null;
}

export interface NetworkRankingItem {
  networkId: string;
  rank: number;
  metricValue: number;
  metricLabel: string;
}

export interface ComparisonResponse {
  dateFrom: string;
  dateTo: string;
  metric: ComparisonMetric;
  networks: NetworkComparisonItem[];
  crossNetwork: CrossNetworkMetrics;
  rankings: NetworkRankingItem[];
  cachedAt: string | null;
}
