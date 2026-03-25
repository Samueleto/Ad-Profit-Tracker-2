// Step 114: Geo breakdown types

export interface GeoCountryRow {
  countryCode: string;
  countryName: string;
  flagEmoji: string;
  revenue: number | null;
  cost: number | null;
  netProfit: number | null;
  roi: number | null;
  impressions: number | null;
  clicks: number | null;
  metricShare: number; // 0 to 100
  colorCode: string; // 'positive' | 'negative' | 'neutral'
}

export interface GeoNetworkContribution {
  networkName: string;
  dataRole: 'Cost Only' | 'Revenue Only' | 'Both';
  primaryMetricValue: number | null;
  percentageOfTotal: number;
}

export interface GeoBreakdownResponse {
  countries: GeoCountryRow[];
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
}

export interface GeoRoiEnrichment {
  countryCode: string;
  colorCode: string;
}

export interface GeoSnapshotDayPoint {
  date: string;
  netProfit: number | null;
}

export type MetricToggle = 'Revenue' | 'Cost' | 'Profit';

export type TopNOption = 10 | 20 | 50;
