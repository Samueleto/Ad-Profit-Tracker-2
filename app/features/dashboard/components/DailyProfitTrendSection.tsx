'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAuth } from 'firebase/auth';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Line, LineChart,
} from 'recharts';
import { format, subDays, startOfMonth, differenceInDays } from 'date-fns';
import { ChevronDown, AlertCircle, Loader2 } from 'lucide-react';

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

async function authFetch(path: string): Promise<Response> {
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken();
  return fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
}

function presetRange(p: Preset): { from: string; to: string } {
  const today = new Date();
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
  if (p === '7d') return { from: fmt(subDays(today, 6)), to: fmt(today) };
  if (p === '14d') return { from: fmt(subDays(today, 13)), to: fmt(today) };
  if (p === '30d') return { from: fmt(subDays(today, 29)), to: fmt(today) };
  if (p === 'month') return { from: fmt(startOfMonth(today)), to: fmt(today) };
  return { from: fmt(subDays(today, 6)), to: fmt(today) };
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
}

function SnapshotPanel({ date, onClose }: SnapshotPanelProps) {
  const [snap, setSnap] = useState<SnapshotData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch(`/api/stats/snapshot?date=${date}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setSnap(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [date]);

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mt-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Snapshot: {date}</p>
        <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
      </div>
      {loading ? (
        <div className="animate-pulse h-12 bg-gray-200 dark:bg-gray-700 rounded" />
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

interface DailyProfitTrendSectionProps {
  onSyncNow?: () => void;
}

export default function DailyProfitTrendSection({ onSyncNow }: DailyProfitTrendSectionProps) {
  const [metric, setMetric] = useState<Metric>('netProfit');
  const [preset, setPreset] = useState<Preset>('7d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [series, setSeries] = useState<DayPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorType, setErrorType] = useState<'none' | '404' | '500' | '403' | '401'>('none');
  const [snapshotDate, setSnapshotDate] = useState<string | null>(null);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  const getRange = useCallback((): { from: string; to: string } | null => {
    if (preset === 'custom') {
      if (!customFrom || !customTo) return null;
      if (differenceInDays(new Date(customTo), new Date(customFrom)) > 90) return null;
      return { from: customFrom, to: customTo };
    }
    return presetRange(preset);
  }, [preset, customFrom, customTo]);

  const fetchData = useCallback(async () => {
    const range = getRange();
    if (!range) return;
    setLoading(true);
    setErrorType('none');
    try {
      const params = new URLSearchParams({ groupBy: 'daily', dateFrom: range.from, dateTo: range.to });
      const [roiRes, breakdownRes] = await Promise.all([
        authFetch(`/api/roi/compute?${params}`),
        authFetch(`/api/roi/breakdown?dimension=daily&dateFrom=${range.from}&dateTo=${range.to}`),
      ]);

      if (roiRes.status === 401) {
        // Try token refresh
        const auth = getAuth();
        try {
          await auth.currentUser?.getIdToken(true);
          fetchData();
        } catch {
          window.location.href = '/?toast=session_expired';
        }
        return;
      }
      if (roiRes.status === 403) { setErrorType('403'); return; }
      if (roiRes.status === 404) { setErrorType('404'); return; }
      if (!roiRes.ok) { setErrorType('500'); return; }

      const roiData = await roiRes.json();
      const breakdownData = breakdownRes.ok ? await breakdownRes.json() : { rows: [] };

      const breakdownMap: Record<string, { colorCode?: string }> = {};
      for (const row of (breakdownData.rows ?? breakdownData.days ?? [])) {
        breakdownMap[row.date] = row;
      }

      const raw: DayPoint[] = (roiData.rows ?? roiData.data ?? roiData.series ?? []).map((d: { date: string; netProfit?: number; revenue?: number; cost?: number; roi?: number }) => ({
        date: d.date,
        netProfit: d.netProfit ?? null,
        revenue: d.revenue ?? null,
        cost: d.cost ?? null,
        roi: d.roi ?? null,
        colorCode: (breakdownMap[d.date]?.colorCode ?? 'amber') as 'green' | 'red' | 'amber',
      }));

      setSeries(computeMovingAvg(raw, 'netProfit'));
    } catch { setErrorType('500'); }
    finally { setLoading(false); }
  }, [getRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCustomFrom = (v: string) => {
    setCustomFrom(v);
    setRangeError(customTo && differenceInDays(new Date(customTo), new Date(v)) > 90 ? 'Max 90 days.' : null);
  };
  const handleCustomTo = (v: string) => {
    setCustomTo(v);
    setRangeError(customFrom && differenceInDays(new Date(v), new Date(customFrom)) > 90 ? 'Max 90 days.' : null);
  };

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
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
      {/* Card header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
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
              <button key={p} onClick={() => setPreset(p)}
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
          {rangeError && <span className="text-xs text-red-500">{rangeError}</span>}
          <button onClick={exportChart}
            className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Export
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="h-[220px] md:h-[320px] animate-pulse bg-gray-100 dark:bg-gray-800 rounded-xl" />
      )}

      {/* Error states */}
      {!loading && errorType === '403' && (
        <div className="flex items-center gap-2 text-sm text-red-500 p-4">
          <AlertCircle className="w-4 h-4" /> Access Denied.
          <a href="/dashboard" className="underline text-xs">Go to Dashboard</a>
        </div>
      )}
      {!loading && errorType === '404' && (
        <div className="text-center py-10">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">No data found for selected range.</p>
          <button onClick={() => setPreset('7d')} className="text-xs text-blue-600 underline">Reset to Last 7 days</button>
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
                {/* 7-day moving average */}
                <Area type="monotone" dataKey="movingAvg" stroke="#9ca3af" fill="none"
                  strokeDasharray="3 3" strokeWidth={1} dot={false} connectNulls name="7-day avg" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Snapshot drill-down */}
          {snapshotDate && <SnapshotPanel date={snapshotDate} onClose={() => setSnapshotDate(null)} />}

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
  );
}
