'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getAuthHeaders } from '@/lib/auth/getAuthHeaders';
import { format, subDays, startOfMonth, differenceInDays } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TrendMetric = 'profit' | 'revenue' | 'cost' | 'roi';
export type TrendStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';

export interface SeriesPoint {
  date: string;
  netProfit: number | null;
  revenue: number | null;
  cost: number | null;
  roi: number | null;
  colorCode: string | null;
  roiIndicator: string | null;
}

export interface PatternInsights {
  bestDay: { date: string; value: number } | null;
  worstDay: { date: string; value: number } | null;
  longestStreak: number;
  periodOverPeriodChange: number | null;
}

export interface UseDailyProfitTrendResult {
  seriesData: SeriesPoint[];
  movingAverage: (number | null)[];
  patternInsights: PatternInsights;
  isOverallPositive: boolean;
  status: TrendStatus;
  errorType: number | null;
  retry: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function compute7DayMA(points: SeriesPoint[]): (number | null)[] {
  return points.map((_, i) => {
    const window = points.slice(Math.max(0, i - 6), i + 1).map(p => p.netProfit);
    const valid = window.filter(v => v !== null) as number[];
    if (!valid.length) return null;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
  });
}

function computePatternInsights(series: SeriesPoint[], priorPeriodTotal: number | null): PatternInsights {
  const withData = series.filter(p => p.netProfit !== null) as (SeriesPoint & { netProfit: number })[];
  if (!withData.length) return { bestDay: null, worstDay: null, longestStreak: 0, periodOverPeriodChange: null };

  const best = withData.reduce((a, b) => b.netProfit > a.netProfit ? b : a);
  const worst = withData.reduce((a, b) => b.netProfit < a.netProfit ? b : a);

  let longestStreak = 0;
  let currentStreak = 0;
  for (const p of series) {
    if ((p.netProfit ?? 0) > 0) { currentStreak++; longestStreak = Math.max(longestStreak, currentStreak); }
    else { currentStreak = 0; }
  }

  const currentTotal = withData.reduce((sum, p) => sum + p.netProfit, 0);
  let periodOverPeriodChange: number | null = null;
  if (priorPeriodTotal !== null && priorPeriodTotal !== 0) {
    periodOverPeriodChange = ((currentTotal - priorPeriodTotal) / Math.abs(priorPeriodTotal)) * 100;
  }

  return {
    bestDay: { date: best.date, value: best.netProfit },
    worstDay: { date: worst.date, value: worst.netProfit },
    longestStreak,
    periodOverPeriodChange,
  };
}

async function authFetch<T>(path: string): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(path, { headers });
  if (!res.ok) {
    const err = new Error(`Request failed: ${res.status}`);
    (err as Error & { status: number }).status = res.status;
    throw err;
  }
  return res.json();
}

// ─── useDailyProfitTrend ──────────────────────────────────────────────────────

export function useDailyProfitTrend(dateFrom: string, dateTo: string) {
  const [seriesData, setSeriesData] = useState<SeriesPoint[]>([]);
  const [priorTotal, setPriorTotal] = useState<number | null>(null);
  const [status, setStatus] = useState<TrendStatus>('idle');
  const [errorType, setErrorType] = useState<number | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!dateFrom || !dateTo) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setStatus('loading');
    setErrorType(null);

    const daysDiff = differenceInDays(new Date(dateTo), new Date(dateFrom));
    const priorFrom = format(subDays(new Date(dateFrom), daysDiff + 1), 'yyyy-MM-dd');
    const priorTo = format(subDays(new Date(dateFrom), 1), 'yyyy-MM-dd');

    const computeParams = new URLSearchParams({ dateFrom, dateTo, groupBy: 'daily' });
    const breakdownParams = new URLSearchParams({ dateFrom, dateTo, dimension: 'daily' });
    const priorParams = new URLSearchParams({ dateFrom: priorFrom, dateTo: priorTo, groupBy: 'total' });

    (async () => {
      try {
        const [computeData, breakdownData, priorData] = await Promise.all([
          authFetch<{ series?: { date?: string; key?: string; netProfit?: number; revenue?: number; cost?: number; roi?: number; colorCode?: string; roiIndicator?: string }[] }>(`/api/roi/compute?${computeParams}`),
          authFetch<{ breakdown?: { key?: string; netProfit?: number; revenue?: number; cost?: number; roi?: number; colorCode?: string; roiIndicator?: string }[] }>(`/api/roi/breakdown?${breakdownParams}`),
          authFetch<{ netProfit?: number }>(`/api/roi/compute?${priorParams}`).catch(() => null),
        ]);

        if (abortRef.current?.signal.aborted) return;

        // Merge by date
        const breakdownByDate = new Map(
          (breakdownData.breakdown ?? []).map(b => [b.key, b])
        );

        const computeSeries = computeData.series ?? [];
        const merged: SeriesPoint[] = computeSeries.map(pt => {
          const date = pt.date ?? pt.key ?? '';
          const bd = breakdownByDate.get(date) ?? {};
          return {
            date,
            netProfit: pt.netProfit ?? bd.netProfit ?? null,
            revenue: pt.revenue ?? bd.revenue ?? null,
            cost: pt.cost ?? bd.cost ?? null,
            roi: pt.roi ?? bd.roi ?? null,
            colorCode: pt.colorCode ?? bd.colorCode ?? null,
            roiIndicator: pt.roiIndicator ?? bd.roiIndicator ?? null,
          };
        });

        setSeriesData(merged);
        setPriorTotal(priorData?.netProfit ?? null);
        setStatus(merged.length === 0 ? 'empty' : 'success');
      } catch (err) {
        if (abortRef.current?.signal.aborted) return;
        if (err instanceof Error && err.name === 'AbortError') return;
        const status = (err as Error & { status?: number }).status ?? 500;
        setErrorType(status);
        setStatus('error');
      }
    })();

    return () => { abortRef.current?.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, retryTick]);

  const retry = useCallback(() => setRetryTick(n => n + 1), []);

  const movingAverage = useMemo(() => compute7DayMA(seriesData), [seriesData]);

  const patternInsights = useMemo(() => computePatternInsights(seriesData, priorTotal), [seriesData, priorTotal]);

  const isOverallPositive = useMemo(
    () => seriesData.reduce((sum, p) => sum + (p.netProfit ?? 0), 0) >= 0,
    [seriesData]
  );

  return { seriesData, movingAverage, patternInsights, isOverallPositive, status, errorType, retry };
}

// ─── useDaySnapshot (lazy) ────────────────────────────────────────────────────

export function useDaySnapshot() {
  const [date, setDate] = useState<string | null>(null);
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!date) return;
    setLoading(true);
    setError(null);
    authFetch<unknown>(`/api/stats/snapshot?date=${date}`)
      .then(d => setData(d))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [date]);

  return { fetchSnapshot: setDate, data, loading, error };
}
