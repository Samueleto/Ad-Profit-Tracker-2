// Step 138: TypeScript types for performance benchmarking

import type { Timestamp } from 'firebase-admin/firestore';

export type MetricKey = 'roi' | 'ctr' | 'cpm' | 'revenue' | 'cost' | 'impressions' | 'clicks';

export interface MetricTargetEntry {
  customTarget: number | null;
  useDefault: boolean;
  updatedAt: Timestamp | null;
}

export interface BenchmarkDocument {
  id: string;
  userId: string;
  metricTargets: Record<MetricKey, MetricTargetEntry>;
  systemDefaults: Record<MetricKey, number>;
  historicalWindowDays: number;
  performanceScore: number | null;
  performanceScoreComputedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ActualMetric {
  value: number | null;
  unit: string;
}

export interface HistoricalAverage {
  value: number | null;
  daysUsed: number;
  windowDays: number;
}

export interface IndustryBenchmark {
  value: number;
  isCustom: boolean;
  source: 'custom' | 'system_default';
}

export interface PerformanceGaps {
  vsHistorical: number | null;
  vsIndustry: number | null;
}

export interface BenchmarkPerformanceResponse {
  dateFrom: string;
  dateTo: string;
  metric: MetricKey;
  networkId: string | null;
  actual: ActualMetric;
  historicalAverage: HistoricalAverage;
  industryBenchmark: IndustryBenchmark;
  gaps: PerformanceGaps;
  performanceRatio: number | null;
  trend: 'above' | 'below' | 'at' | 'no_data';
  cachedAt: string | null;
}

export interface BenchmarkSettingsMetric {
  metric: MetricKey;
  customTarget: number | null;
  useDefault: boolean;
  effectiveTarget: number;
  systemDefault: number;
  unit: string;
  isCustom: boolean;
  updatedAt: Timestamp | null;
}

export interface BenchmarkSettingsResponse {
  historicalWindowDays: number;
  metricTargets: BenchmarkSettingsMetric[];
  lastUpdatedAt: Timestamp | null;
}

export interface BenchmarkSettingsPatchBody {
  metricTargets?: Partial<Record<MetricKey, { customTarget?: number | null; useDefault?: boolean }>>;
  historicalWindowDays?: number;
}
