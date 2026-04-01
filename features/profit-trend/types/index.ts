// Step 113: Chart data types for profit trend visualization

import { addDays, differenceInDays } from 'date-fns';

export interface DailyProfitDataPoint {
  date: string; // ISO format
  netProfit: number | null;
  revenue: number | null;
  cost: number | null;
  roi: number | null;
  colorCode: 'green' | 'red' | 'amber' | null;
  roiIndicator: string | null;
}

export type ChartMetric = 'profit' | 'revenue' | 'cost' | 'roi';

export type DateRangeOption = '7d' | '14d' | '30d' | 'thisMonth' | 'custom';

export interface DateRange {
  from: Date;
  to: Date;
}

/**
 * Validates and clamps a date range to max 90 days.
 * If the range exceeds 90 days, `to` is clamped to `from + 90 days`.
 */
export function clampDateRange(range: DateRange): DateRange {
  const diff = differenceInDays(range.to, range.from);
  if (diff > 90) {
    return { from: range.from, to: addDays(range.from, 90) };
  }
  return range;
}

export interface PatternInsights {
  bestDay: DailyProfitDataPoint | null;
  worstDay: DailyProfitDataPoint | null;
  longestProfitableStreak: number;
  periodOverPeriodChange: number | null;
}

export interface MovingAveragePoint {
  date: string;
  value: number | null;
}

export interface ComputedChartData {
  dataPoints: DailyProfitDataPoint[];
  movingAverage: MovingAveragePoint[];
  insights: PatternInsights;
  overallProfitable: boolean;
}
