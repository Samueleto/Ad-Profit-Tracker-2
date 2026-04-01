// Step 134: TypeScript types for dashboard data

import type { Timestamp } from 'firebase-admin/firestore';

export interface DashboardAdStatDocument {
  userId: string;
  date: string; // YYYY-MM-DD
  network: string;
  revenue: number;
  cost: number;
  country: string;
  impressions?: number;
  clicks?: number;
  ctr?: number;
  cpm?: number;
}

export interface DashboardNetworkConfigDocument {
  userId: string;
  networkId: string;
  lastSyncedAt: Timestamp | string | null;
  lastSyncStatus: 'success' | 'error' | 'pending' | null;
  dataRole: 'revenue' | 'cost';
}

export interface DashboardKpis {
  totalRevenue: number;
  totalCost: number;
  netProfit: number;
  roi: number | null;
  revenueChange: number | null;
  costChange: number | null;
  profitChange: number | null;
  roiChange: number | null;
}

export interface DashboardDailyPoint {
  date: string;
  revenue: number;
  cost: number;
  netProfit: number;
  roi: number | null;
}

export interface DashboardTopCountry {
  country: string;
  countryName: string;
  revenue: number;
  cost: number;
  netProfit: number;
  metricShare: number;
}

export interface DashboardNetworkMetrics {
  networkId: string;
  dataRole: 'revenue' | 'cost';
  primaryMetric: number;
  lastSyncedAt: string | null;
  lastSyncStatus: string | null;
}

export interface DashboardMetricsResponse {
  dateFrom: string;
  dateTo: string;
  kpis: DashboardKpis;
  dailySeries: DashboardDailyPoint[];
  topCountries: DashboardTopCountry[];
  perNetwork: DashboardNetworkMetrics[];
  cachedAt: string | null;
}

export interface DashboardDateRange {
  from: string;
  to: string;
  label: string;
}

export interface KpiCard {
  label: string;
  value: number | null;
  change: number | null;
  changeDirection: 'up' | 'down' | 'neutral';
  format: 'currency' | 'percent';
}
