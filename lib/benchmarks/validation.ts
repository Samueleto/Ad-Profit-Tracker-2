// Step 138: Benchmark validation helpers

import type { MetricKey } from '@/features/benchmarking/types';

const METRIC_CAPS: Record<MetricKey, { max: number; min: number }> = {
  roi: { max: 10000, min: 0 },
  ctr: { max: 10000, min: 0 },
  cpm: { max: 1000, min: 0 },
  revenue: { max: 10000000, min: 0 },
  cost: { max: 10000000, min: 0 },
  impressions: { max: 10000000, min: 0 },
  clicks: { max: 10000000, min: 0 },
};

export function validateMetricTarget(metric: MetricKey, value: number): string | null {
  const cap = METRIC_CAPS[metric];
  if (value < cap.min) return `${metric} must be at least ${cap.min}`;
  if (value > cap.max) return `${metric} cannot exceed ${cap.max}`;
  return null;
}

export function validateHistoricalWindowDays(days: number): string | null {
  if (days < 7) return 'Historical window must be at least 7 days';
  if (days > 365) return 'Historical window cannot exceed 365 days';
  return null;
}
