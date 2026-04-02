'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth } from 'firebase/auth';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from 'recharts';
import { format, differenceInDays } from 'date-fns';
import { ChevronDown, AlertCircle, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useDateRangeStore } from '@/store/dateRangeStore';
import ChartErrorBoundary from './ChartErrorBoundary';

type Metric = 'netProfit' | 'revenue' | 'cost' | 'roi';
type Preset = '7d' | '14d' | '30d' | 'month' | 'custom';

interface DayPoint {
  date: string;
  netProfit: number | null;
  revenue: number | null;
  cost: number | null;
  roi: number | null;
  colorCode?: 'green' | 'red' | 'amber';
  movingAvg?: number | null;
}

interface SnapshotData {
  date: string;
  revenue: number;
  cost: number;
  netProfit: number;
  roi: number;
}

// Fetch fresh token each call — Firebase SDK manages caching/refresh internally.
// Throws if no authenticated user.
async function getAuthHeaders(): Promise<{ Authorization: string }> {
  const auth = getAuth();
  if (!auth.currentUser) throw new Error('Not authenticated');
  const token = await auth.currentUser.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

// Fetch with one automatic token force-refresh on 401.
// Returns { res, sessionExpired: true } when the retry also fails with 401.
async function authFetch(
  path: string,
  init?: RequestInit
): Promise<{ res: Response; sessionExpired: boolean }> {
  const headers = await getAuthHeaders();
  const res = await fetch(path, { ...init, headers: { ...init?.headers, ...headers } });

  if (res.status !== 401) return { res, sessionExpired: false };

  // Force-refresh and retry exactly once
  const auth = getAuth();
  if (!auth.currentUser) return { res, sessionExpired: true };
  const freshToken = await auth.currentUser.getIdToken(true);
  const retryRes = await fetch(path, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${freshToken}` },
  });
  return { res: retryRes, sessionExpired: retryRes.status === 401 };
}

function computeMovingAvg(data: DayPoint[], field: Metric, window = 7): DayPoint[] {
  return data.map((pt, i) => {
    const slice = data.slice(Math.max(0, i - window + 1), i + 1);
    const valid = slice.map(d => d[field]).filter(v => v != null) as number[];
    const avg = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
    return { ...pt, movingAvg: avg };
  });
}

function computeInsights(data: DayPoint[]): {
  bestDay: DayPoint | null;
  worstDay: DayPoint | null;
  longestStreak: number;
  periodChange: number | null;
} {
  const valid = data.filter(d => d.netProfit != null);
  if (!valid.length) return { bestDay: null, worstDay: null, longestStreak: 0, periodChange: null };

  const bestDay = valid.reduce((a, b) => (b.netProfit! > a.netProfit! ? b : a));
  const worstDay = valid.reduce((a, b) => (b.netProfit! < a.netProfit! ? b : a));

  let streak = 0, maxStreak = 0;
  for (const d of valid) {
    if ((d.netProfit ?? 0) > 0) { streak++; maxStreak = Math.max(maxStreak, streak); } else { streak = 0; }
  }

  const half = Math.floor(valid.length / 2);
  const firstHalf = valid.slice(0, half).reduce((a, b) => a + (b.netProfit ?? 0), 0);
  const secondHalf = valid.slice(half).reduce((a, b) => a + (b.netProfit ?? 0), 0);
  const periodChange = firstHalf !== 0 ? ((secondHalf - firstHalf) / Math.abs(firstHalf)) * 100 : null;

  return { bestDay, worstDay, longestStreak: maxStreak, periodChange };
}

interface SnapshotPanelProps {
  date: string;
  onClose: () => void;
  onSessionExpired: () => void;
}

function SnapshotPanel({ date, onClose, onSessionExpired }: SnapshotPanelProps) {
  const [snap, setSnap] = useState<SnapshotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setAccessDenied(false);
    setFetchError(false);
    authFetch(`/api/stats/snapshot?date=${encodeURIComponent(date)}`)
      .then(({ res, sessionExpired }) => {
        if (cancelled) return;
        if (sessionExpired) { onSessionExpired(); return; }
        if (res.status === 403) { setAccessDenied(true); return; }
        if (!res.ok) { setFetchError(true); return; }
        return res.json().then(d => { if (!cancelled) setSnap(d); });
      })
      .catch(() => { if (!cancelled) setFetchError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [date, onSessionExpired]);

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mt-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Snapshot: {date}</p>
        <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
      </div>
      {loading ? (
        <div className="animate-pulse h-12 bg-gray-200 dark:bg-gray-700 rounded" />
      ) : accessDenied ? (
        <div className="flex items-center gap-2 text-xs text-red-500">
          <ShieldAlert className="w-3.5 h-3.5" /> Access Denied.
          <a href="/dashboard" className="underline">Go to Dashboard</a>
        </div>
      ) : fetchError ? (
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-red-500">
            <AlertCircle className="w-3.5 h-3.5" /> Failed to load snapshot data.
          </span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 underline">Close</button>
        </div>
      ) : snap ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {[
            { label: 'Revenue', value: `$${snap.revenue.toFixed(2)}` },
            { label: 'Cost', value: `$${snap.cost.toFixed(2)}` },
            { label: 'Net Profit', value: `$${snap.netProfit.toFixed(2)}` },
            { label: 'ROI', value: `${snap.roi.toFixed(2)}%` },
          ].map(s => (
            <div key={s.label}>
              <p className="text-gray-400">{s.label}</p>
              <p className="font-semibold text-gray-900 dark:text-white">{s.value}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-500">No snapshot data for this date.</p>
      )}
    </div>
  );
}

// Map DailyProfitTrendSection preset ids to/from useDateRangeStore preset ids
const PRESET_TO_STORE: Record<Preset, string> = {
  '7d': 'last7',
  '14d': 'last14',
  '30d': 'last30',
  'month': 'thisMonth',
  'custom': 'custom',
};
const STORE_TO_PRESET: Record<string, Preset> = {
  'last7': '7d',
  'last14': '14d',
  'last30': '30d',
  'last90': '30d', // approximate
  'thisMonth': 'month',
  'custom': 'custom',
};

const MAX_RANGE_DAYS = 90;

interface DailyProfitTrendSectionProps {
  onSyncNow?: () => void;
}

export default function DailyProfitTrendSection({ onSyncNow }: DailyProfitTrendSectionProps) {
  const router = useRouter();
  const { fromDate: storeFrom, toDate: storeTo, preset: storePreset, setPreset: storeSetPreset, setCustomRange, applyCustomRange } = useDateRangeStore();

  const [metric, setMetric] = useState<Metric>('netProfit');
  const preset: Preset = STORE_TO_PRESET[storePreset] ?? '30d';
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [rangeNotice, setRangeNotice] = useState<string | null>(null);
  const [series, setSeries] = useState<DayPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorType, setErrorType] = useState<'none' | '404' | '500' | '403'>('none');
  const [sessionExpired, setSessionExpired] = useState(false);
  const [snapshotDate, setSnapshotDate] = useState<string | null>(null);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  // Redirect on session expiry with toast
  useEffect(() => {
    if (sessionExpired) {
      toast.error('Session expired. Please sign in again.');
      router.replace('/');
    }
  }, [sessionExpired, router]);

  useEffect(() => {
    if (storePreset === 'custom' && storeFrom && storeTo) {
      setCustomFrom(storeFrom);
      setCustomTo(storeTo);
    }
  }, [storePreset, storeFrom, storeTo]);

  const handlePresetClick = (p: Preset) => {
    if (p === 'custom') {
      storeSetPreset('custom');
    } else {
      storeSetPreset(PRESET_TO_STORE[p] as Parameters<typeof storeSetPreset>[0]);
    }
  };

  // Clamp date range to 90 days, show notice if clamped
  const handleCustomFrom = (v: string) => {
    setCustomFrom(v);
    if (customTo && differenceInDays(new Date(customTo), new Date(v)) > MAX_RANGE_DAYS) {
      setRangeNotice(`Date range capped at ${MAX_RANGE_DAYS} days.`);
    } else {
      setRangeNotice(null);
    }
    setCustomRange(v, customTo);
  };

  const handleCustomTo = (v: string) => {
    let effectiveTo = v;
    let notice: string | null = null;
    if (customFrom && differenceInDays(new Date(v), new Date(customFrom)) > MAX_RANGE_DAYS) {
      // Clamp: set dateTo = dateFrom + 90 days
      const clamped = new Date(new Date(customFrom).getTime() + MAX_RANGE_DAYS * 86400000);
      effectiveTo = clamped.toISOString().split('T')[0];
      notice = `Date range capped at ${MAX_RANGE_DAYS} days.`;
    }
    setCustomTo(effectiveTo);
    setRangeNotice(notice);
    setCustomRange(customFrom, effectiveTo);
    if (customFrom && effectiveTo) applyCustomRange();
  };

  const handleSessionExpired = useCallback(() => {
    setSessionExpired(true);
  }, []);

  const fetchData = useCallback(async () => {
    if (!storeFrom || !storeTo) return;

    // Enforce 90-day cap before making any API call
    const diff = differenceInDays(new Date(storeTo), new Date(storeFrom));
    const effectiveFrom = storeFrom;
    const effectiveTo = diff > MAX_RANGE_DAYS
      ? new Date(new Date(storeFrom).getTime() + MAX_RANGE_DAYS * 86400000).toISOString().split('T')[0]
      : storeTo;

    if (diff > MAX_RANGE_DAYS) {
      setRangeNotice(`Date range capped at ${MAX_RANGE_DAYS} days.`);
    }

    setLoading(true);
    setErrorType('none');

    try {
      const params = new URLSearchParams({ groupBy: 'daily', dateFrom: effectiveFrom, dateTo: effectiveTo });
      const [{ res: roiRes, sessionExpired: roiExpired }, { res: breakdownRes, sessionExpired: bdExpired }] =
        await Promise.all([
          authFetch(`/api/roi/compute?${params}`),
          authFetch(`/api/roi/breakdown?dimension=daily&dateFrom=${effectiveFrom}&dateTo=${effectiveTo}`),
        ]);

      if (roiExpired || bdExpired) { handleSessionExpired(); return; }
      if (roiRes.status === 403) { setErrorType('403'); return; }
      if (roiRes.status === 404) { setErrorType('404'); return; }
      if (!roiRes.ok) { setErrorType('500'); return; }
      // Partial failure — breakdown is required for colorCode; treat as 500
      if (!breakdownRes.ok) { setErrorType('500'); return; }

      const roiData = await roiRes.json();
      const breakdownData = await breakdownRes.json();

      const breakdownMap: Record<string, { colorCode?: string }> = {};
      for (const row of (breakdownData.rows ?? breakdownData.days ?? breakdownData.breakdown ?? [])) {
        breakdownMap[row.date] = row;
      }

      const raw: DayPoint[] = (roiData.rows ?? roiData.data ?? roiData.series ?? roiData.breakdown ?? []).map(
        (d: { date: string; netProfit?: number; revenue?: number; cost?: number; roi?: number }) => ({
          date: d.date,
          netProfit: d.netProfit ?? null,
          revenue: d.revenue ?? null,
          cost: d.cost ?? null,
          roi: d.roi ?? null,
          colorCode: (breakdownMap[d.date]?.colorCode ?? 'amber') as 'green' | 'red' | 'amber',
        })
      );

      setSeries(computeMovingAvg(raw, 'netProfit'));
    } catch {
      setErrorType('500');
    } finally {
      setLoading(false);
    }
  }, [storeFrom, storeTo, handleSessionExpired]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const exportChart = () => {
    const svg = chartRef.current?.querySelector('svg');
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `profit-trend-${format(new Date(), 'yyyy-MM-dd')}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const insights = computeInsights(series);
  const periodTotal = series.reduce((a, b) => a + (b.netProfit ?? 0), 0);
  const areaFill = periodTotal >= 0 ? '#22c55e' : '#ef4444';
  const areaStroke = periodTotal >= 0 ? '#16a34a' : '#dc2626';

  const METRICS: { id: Metric; label: string }[] = [
    { id: 'netProfit', label: 'Profit' },
    { id: 'revenue', label: 'Revenue' },
    { id: 'cost', label: 'Cost' },
    { id: 'roi', label: 'ROI' },
  ];

  return (
    <ChartErrorBoundary>
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
      {/* Card header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        {loading ? (
          <>
            {/* Metric toggle skeleton */}
            <div className="flex gap-1">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-6 w-14 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
              ))}
            </div>
            {/* Date range skeleton */}
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-6 w-10 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Metric toggle */}
            <div className="flex gap-1">
              {METRICS.map(m => (
                <button key={m.id} onClick={() => setMetric(m.id)}
                  className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
                    metric === m.id
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >{m.label}</button>
              ))}
            </div>

            {/* Date range + export */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1">
                {(['7d', '14d', '30d', 'month', 'custom'] as const).map(p => (
                  <button key={p} onClick={() => handlePresetClick(p)}
                    className={`px-2 py-1 text-xs rounded border transition-colors ${
                      preset === p ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}>
                    {p === '7d' ? '7d' : p === '14d' ? '14d' : p === '30d' ? '30d' : p === 'month' ? 'Month' : 'Custom'}
                  </button>
                ))}
              </div>
              {preset === 'custom' && (
                <div className="flex items-center gap-1">
                  <input type="date" value={customFrom} onChange={e => handleCustomFrom(e.target.value)}
                    className="px-2 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800 dark:text-white" />
                  <span className="text-xs text-gray-400">–</span>
                  <input type="date" value={customTo} onChange={e => handleCustomTo(e.target.value)}
                    className="px-2 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800 dark:text-white" />
                </div>
              )}
              {rangeNotice && <span className="text-xs text-amber-500">{rangeNotice}</span>}
              <button onClick={exportChart}
                className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Export
              </button>
            </div>
          </>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="h-[220px] md:h-[320px] animate-pulse bg-gray-100 dark:bg-gray-800 rounded-xl" />
      )}

      {/* Error states */}
      {!loading && errorType === '403' && (
        <div className="flex items-center gap-2 text-sm text-red-500 p-4 bg-red-50 dark:bg-red-900/10 rounded-lg">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span>Access Denied.</span>
          <a href="/dashboard" className="underline text-xs">Go to Dashboard</a>
        </div>
      )}
      {!loading && errorType === '404' && (
        <div className="text-center py-10">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">No data found for selected range.</p>
          <button onClick={() => handlePresetClick('7d')} className="text-xs text-blue-600 underline">Reset to Last 7 days</button>
        </div>
      )}
      {!loading && errorType === '500' && (
        <div className="flex items-center gap-2 text-sm text-red-500 p-4">
          <AlertCircle className="w-4 h-4" /> Failed to load trend data.
          <button onClick={fetchData} className="text-xs underline">Retry</button>
        </div>
      )}

      {/* Empty */}
      {!loading && errorType === 'none' && series.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            No profit data for this range. Sync your networks to see trends.
          </p>
          <button onClick={onSyncNow} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
            Sync Now
          </button>
        </div>
      )}

      {/* Chart */}
      {!loading && errorType === 'none' && series.length > 0 && (
        <>
          <div ref={chartRef} className="h-[220px] md:h-[320px]" role="presentation">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 4, right: 20, bottom: 0, left: 0 }}
                onMouseDown={e => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const payload = (e as any)?.activePayload?.[0]?.payload as DayPoint | undefined;
                  if (payload?.date) setSnapshotDate(payload.date);
                }}>
                <defs>
                  <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={areaFill} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={areaFill} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }}
                  tickFormatter={v => { try { return format(new Date(v), 'MMM d'); } catch { return v; } }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as DayPoint;
                    return (
                      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-xs shadow-lg">
                        <p className="font-medium mb-1">{label}</p>
                        <p>Net Profit: <strong>${(d.netProfit ?? 0).toFixed(2)}</strong></p>
                        <p>Revenue: <strong>${(d.revenue ?? 0).toFixed(2)}</strong></p>
                        <p>Cost: <strong>${(d.cost ?? 0).toFixed(2)}</strong></p>
                        <p>ROI: <strong>{(d.roi ?? 0).toFixed(2)}%</strong></p>
                      </div>
                    );
                  }}
                />
                <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="4 2"
                  label={{ value: 'Break Even', position: 'insideRight', fontSize: 9, fill: '#9ca3af' }} />
                <Area type="monotone" dataKey={metric} stroke={areaStroke} fill="url(#areaFill)"
                  connectNulls={false} strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="movingAvg" stroke="#9ca3af" fill="none"
                  strokeDasharray="3 3" strokeWidth={1} dot={false} connectNulls name="7-day avg" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {snapshotDate && (
            <SnapshotPanel
              date={snapshotDate}
              onClose={() => setSnapshotDate(null)}
              onSessionExpired={handleSessionExpired}
            />
          )}

          {/* Pattern Insights */}
          <div className="mt-4 border-t border-gray-100 dark:border-gray-800 pt-3">
            <button onClick={() => setInsightsOpen(p => !p)}
              className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${insightsOpen ? 'rotate-180' : ''}`} />
              Pattern Insights
            </button>
            {insightsOpen && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <p className="text-gray-400 mb-0.5">Best Day</p>
                  <p className="font-semibold text-green-600 dark:text-green-400">
                    {insights.bestDay ? `${insights.bestDay.date} ($${insights.bestDay.netProfit!.toFixed(2)})` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 mb-0.5">Worst Day</p>
                  <p className="font-semibold text-red-500">
                    {insights.worstDay ? `${insights.worstDay.date} ($${insights.worstDay.netProfit!.toFixed(2)})` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 mb-0.5">Longest Streak</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{insights.longestStreak} days profitable</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-0.5">Period vs Prior</p>
                  <p className={`font-semibold ${insights.periodChange != null && insights.periodChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                    {insights.periodChange != null ? `${insights.periodChange > 0 ? '+' : ''}${insights.periodChange.toFixed(1)}%` : '—'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
    </ChartErrorBoundary>
  );
}
