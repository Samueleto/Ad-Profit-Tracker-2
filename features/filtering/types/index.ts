// Step 139: TypeScript types for data filtering

export type MetricKey = 'revenue' | 'cost' | 'profit' | 'roi' | 'impressions' | 'clicks' | 'ctr' | 'cpm';
export type DataQualityOption = 'all' | 'anomalies' | 'clean';

export interface FilterState {
  selectedNetworks: string[];
  selectedCountries: string[];
  selectedMetric: MetricKey;
  dataQuality: DataQualityOption;
  searchQuery: string;
}

export interface CountryOption {
  country: string;
  countryName: string;
  hasData: boolean;
}

export interface NetworkOption {
  networkId: string;
  label: string;
  dataRole: 'cost' | 'revenue';
  hasData: boolean;
}

export interface MetricOption {
  metric: MetricKey;
  label: string;
  unit: string;
}

export interface FilterOptionsResponse {
  dateFrom: string;
  dateTo: string;
  countries?: CountryOption[];
  networks?: NetworkOption[];
  metrics?: MetricOption[];
  cachedAt: string | null;
}

export interface FilterStatsRow {
  key: string;
  label: string;
  revenue: number;
  cost: number;
  netProfit: number;
  roi: number | null;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  rowCount: number;
}

export interface FilterStatsSummary {
  totalRevenue: number;
  totalCost: number;
  netProfit: number;
  roi: number | null;
}

export interface FilterStatsResponse {
  rows: FilterStatsRow[];
  summary: FilterStatsSummary;
  filters: Partial<FilterState>;
  hasMore: boolean;
  nextCursor: string | null;
  cachedAt: string | null;
}

export interface SearchResult {
  type: 'country' | 'network';
  key: string;
  label: string;
  revenue: number;
  cost: number;
  netProfit: number;
  roi: number | null;
  impressions: number;
  clicks: number;
  daysWithData: number;
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
  total: number;
}

export interface FilterPreset {
  id: string;
  name: string;
  networks: string[];
  countries: string[];
  metric: MetricKey;
  dataQuality: DataQualityOption;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createdAt: any;
}

export interface PresetsResponse {
  presets: FilterPreset[];
}

export interface FilterOptionsParams {
  dateFrom: string;
  dateTo: string;
  include?: string;
}

export interface FilterStatsParams {
  dateFrom: string;
  dateTo: string;
  networks?: string;
  countries?: string;
  metric?: MetricKey;
  dataQuality?: DataQualityOption;
  groupBy?: string;
  limit?: number;
  cursor?: string;
}

export interface FilterSearchParams {
  dateFrom: string;
  dateTo: string;
  q: string;
  type?: 'country' | 'network' | 'all';
}

export interface CreatePresetBody {
  name: string;
  networks?: string[];
  countries?: string[];
  metric?: MetricKey;
  dataQuality?: DataQualityOption;
}
