// Step 140: TypeScript types for API Explorer

export type NetworkId = 'exoclick' | 'rollerads' | 'zeydoo' | 'propush';

export interface RequiredParam {
  name: string;
  description: string;
}

export interface NetworkConfig {
  networkId: NetworkId;
  endpointUrl: string;
  httpMethod: string;
  requiredParams: RequiredParam[];
  displayName: string;
}

export interface CachedResponse {
  networkId: NetworkId;
  rawResponse: Record<string, unknown>;
  fetchedAt: string;
  httpStatus: number;
}

export interface FieldMapping {
  rawField: string;
  internalField: string;
  notes?: string;
}

export interface RawResponseEndpointResponse {
  networkId: NetworkId;
  rawResponse: Record<string, unknown>;
  fetchedAt: string;
  httpStatus: number;
  config: NetworkConfig;
}

export interface TestConnectionResponse {
  success: boolean;
  networkId: NetworkId;
  latencyMs: number;
  error?: string;
}

export const FIELD_MAPPINGS: Record<NetworkId, FieldMapping[]> = {
  exoclick: [
    { rawField: 'date', internalField: 'date' },
    { rawField: 'country', internalField: 'country' },
    { rawField: 'cost', internalField: 'cost' },
    { rawField: 'impressions', internalField: 'impressions' },
    { rawField: 'clicks', internalField: 'clicks' },
    { rawField: 'ctr', internalField: 'ctr', notes: 'Percentage value' },
    { rawField: 'cpm', internalField: 'cpm' },
  ],
  rollerads: [
    { rawField: 'date', internalField: 'date' },
    { rawField: 'country', internalField: 'country' },
    { rawField: 'revenue', internalField: 'revenue' },
    { rawField: 'impressions', internalField: 'impressions' },
    { rawField: 'clicks', internalField: 'clicks' },
    { rawField: 'ctr', internalField: 'ctr' },
    { rawField: 'cpm', internalField: 'cpm' },
    { rawField: 'ecpm', internalField: 'cpm', notes: 'Effective CPM mapped to cpm field' },
  ],
  zeydoo: [
    { rawField: 'date', internalField: 'date' },
    { rawField: 'country', internalField: 'country' },
    { rawField: 'revenue', internalField: 'revenue' },
    { rawField: 'impressions', internalField: 'impressions' },
    { rawField: 'clicks', internalField: 'clicks' },
    { rawField: 'conversions', internalField: 'conversions' },
  ],
  propush: [
    { rawField: 'date', internalField: 'date' },
    { rawField: 'geo', internalField: 'country', notes: 'geo mapped to country' },
    { rawField: 'revenue', internalField: 'revenue' },
    { rawField: 'impressions', internalField: 'impressions' },
    { rawField: 'clicks', internalField: 'clicks' },
  ],
};

export const NETWORK_CONFIGS: NetworkConfig[] = [
  {
    networkId: 'exoclick',
    displayName: 'ExoClick',
    endpointUrl: 'https://api.exoclick.com/v2/statistics/advertiser/daily',
    httpMethod: 'GET',
    requiredParams: [
      { name: 'date_from', description: 'Start date in YYYY-MM-DD format' },
      { name: 'date_to', description: 'End date in YYYY-MM-DD format' },
    ],
  },
  {
    networkId: 'rollerads',
    displayName: 'RollerAds',
    endpointUrl: 'https://rollerads.com/api/publisher/sites/stat',
    httpMethod: 'GET',
    requiredParams: [
      { name: 'date_from', description: 'Start date in YYYY-MM-DD format' },
      { name: 'date_to', description: 'End date in YYYY-MM-DD format' },
    ],
  },
  {
    networkId: 'zeydoo',
    displayName: 'Zeydoo',
    endpointUrl: 'https://api.zeydoo.com/v1/statistics',
    httpMethod: 'GET',
    requiredParams: [
      { name: 'date_from', description: 'Start date in YYYY-MM-DD format' },
      { name: 'date_to', description: 'End date in YYYY-MM-DD format' },
    ],
  },
  {
    networkId: 'propush',
    displayName: 'Propush',
    endpointUrl: 'https://api.propush.me/v5/pub-statistics',
    httpMethod: 'GET',
    requiredParams: [
      { name: 'date_from', description: 'Start date in YYYY-MM-DD format' },
      { name: 'date_to', description: 'End date in YYYY-MM-DD format' },
    ],
  },
];
