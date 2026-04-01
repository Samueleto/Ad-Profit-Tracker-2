// Step 128: TypeScript types for stat endpoints

import type { Timestamp } from 'firebase-admin/firestore';

export type NetworkId = 'exoclick' | 'rollerads' | 'zeydoo' | 'propush';

export const NETWORK_IDS: NetworkId[] = ['exoclick', 'rollerads', 'zeydoo', 'propush'];
export const REVENUE_NETWORKS: NetworkId[] = ['rollerads', 'zeydoo', 'propush'];

export interface AdStatDocument {
  id: string;
  userId: string;
  networkId: NetworkId;
  dataRole: string; // 'cost' | 'revenue'
  date: string; // YYYY-MM-DD
  country: string | null;
  cost: number | null;
  revenue: number | null;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface NetworkConfigDoc {
  id: string;
  userId: string;
  networkId: NetworkId;
  isActive: boolean;
  lastSyncedAt: Timestamp | null;
  lastSyncStatus: string;
  lastSyncError: string | null;
}

export interface ApiKeyDoc {
  id: string;
  userId: string;
  networkId: NetworkId;
  encryptedKey: string;
  createdAt: Timestamp;
}

export interface AuditLogDoc {
  id: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, unknown>;
  status: 'success' | 'failure';
  createdAt: Timestamp;
}

// Response shape types
export interface SnapshotResponse {
  dateFrom: string;
  dateTo: string;
  totalRevenue: number;
  totalCost: number;
  netProfit: number;
  roi: number | null;
  impressions: number;
  clicks: number;
  averageCtr: number;
  averageCpm: number;
  networksWithData: string[];
  cachedAt: string | null;
}

export interface TrendDataPoint {
  date: string;
  revenue: number;
  cost: number;
  netProfit: number;
  roi: number | null;
  impressions: number;
  clicks: number;
}

export interface TrendResponse {
  dateFrom: string;
  dateTo: string;
  groupBy: string;
  dataPoints: TrendDataPoint[];
  cachedAt: string | null;
}

export interface SummaryResponse {
  dateFrom: string;
  dateTo: string;
  totalRevenue: number;
  totalCost: number;
  netProfit: number;
  roi: number | null;
  revenueByNetwork: Record<string, number>;
  costByNetwork: Record<string, number>;
  cachedAt: string | null;
}

export interface GeoBreakdownRow {
  country: string;
  countryName: string;
  revenue: number;
  cost: number;
  netProfit: number;
  roi: number | null;
  impressions: number;
  clicks: number;
}

export interface GeoBreakdownResponse {
  dateFrom: string;
  dateTo: string;
  countries: GeoBreakdownRow[];
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  cachedAt: string | null;
}

export interface CoverageResponse {
  dateFrom: string;
  dateTo: string;
  networkCoverage: Record<string, { daysWithData: number; totalDays: number; percentage: number }>;
  cachedAt: string | null;
}

export interface BackfillResponse {
  networkId: string;
  dateFrom: string;
  dateTo: string;
  rowsBackfilled: number;
  success: boolean;
}

export interface DatesResponse {
  earliestDate: string | null;
  latestDate: string | null;
  networkDates: Record<string, { earliest: string | null; latest: string | null }>;
}
