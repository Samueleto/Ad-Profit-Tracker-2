'use client';

import { useState, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Settings, AlertTriangle } from 'lucide-react';
import BenchmarkSettingsModal from './BenchmarkSettingsModal';

// ─── Types ────────────────────────────────────────────────────────────────────

type BenchMetric = 'roi' | 'ctr' | 'cpm' | 'revenue' | 'cost' | 'impressions' | 'clicks';

const METRICS: { id: BenchMetric; label: string }[] = [
  { id: 'roi',         label: 'ROI %' },
  { id: 'ctr',         label: 'CTR %' },
  { id: 'cpm',         label: 'CPM' },
  { id: 'revenue',     label: 'Revenue' },
  { id: 'cost',        label: 'Cost' },
  { id: 'impressions', label: 'Impressions' },
  { id: 'clicks',      label: 'Clicks' },
];

const NETWORKS = ['exoclick', 'rollerads', 'zeydoo', 'propush'] as const;
type Network = typeof NETWORKS[number];

const NETWORK_LABELS: Record<Network, string> = {
  exoclick: 'ExoClick',
  rollerads: 'RollerAds',
  zeydoo: 'Zeydoo',
  propush: 'Propush',
};

interface NetworkRow {
  networkId: Network;
  actual: number | null;
  historicalAvg: number | null;
  industryBenchmark: number | null;
  lastSyncStatus: 'success' | 'failed' | 'never' | null;
  circuitBreakerOpen?: boolean;
}

interface TrendPoint {
  date: string;
  actual: number | null;
  historicalAvg: number | null;
}

interface BenchmarkData {
  score: number | null;
  rows: NetworkRow[];
  trend: TrendPoint[];
}

// ─── Auth fetch ───────────────────────────────────────────────────────────────

async function authFetch(path: string): Promise<Response> {
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken();
  return fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

// ─── Circular Gauge ───────────────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <span className="text-xs text-gray-400">N/A</span>
        </div>
        <span className="text-xs text-gray-400">Performance Score</span>
      </div>
    );
  }
  const color = score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-20 h-20">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="8" className="dark:stroke-gray-700" />
          <circle
            cx="40" cy="40" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold" style={{ color }}>{score}</span>
        </div>
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400">Performance Score</span>
    </div>
  );
}

function ShimmerGauge() {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse" />
      <div className="w-24 h-3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
    </div>
  );
}

// ─── MetricShareBar ───────────────────────────────────────────────────────────

function MetricShareBar({ actual, benchmark }: { actual: number | null; benchmark: number | null }) {
  if (actual === null || benchmark === null || benchmark === 0) {
    return <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full" />;
  }
  const pct = Math.min(100, Math.max(0, (actual / (benchmark * 1.5)) * 100));
  return (
    <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Row status colors ────────────────────────────────────────────────────────

function rowColor(actual: number | null, benchmark: number | null): string {
  if (actual === null || benchmark === null) return '';
  const diff = (actual - benchmark) / benchmark;
  if (diff >= 0.1) return 'text-green-600 dark:text-green-400';
  if (diff <= -0.1) return 'text-red-500 dark:text-red-400';
  return 'text-amber-500 dark:text-amber-400';
}

function fmt(val: number | null, metric: BenchMetric): string {
  if (val === null) return '—';
  if (metric === 'roi' || metric === 'ctr') return `${val.toFixed(2)}%`;
  if (metric === 'cpm' || metric === 'revenue' || metric === 'cost') return `$${val.toFixed(2)}`;
  return val.toLocaleString();
}

// ─── Main component ───────────────────────────────────────────────────────────

interface PerformanceBenchmarkingTabProps {
  dateFrom: string;
  dateTo: string;
}

export default function PerformanceBenchmarkingTab({ dateFrom, dateTo }: PerformanceBenchmarkingTabProps) {
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BenchmarkData | null>(null);
  const [metric, setMetric] = useState<BenchMetric>('roi');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const load = useCallback(async () => {
    if (loaded || loading) return;
    setLoading(true);
    setError(null);
    try {
      const [compRes, benchRes, scoreRes] = await Promise.all([
        authFetch(`/api/networks/comparison?dateFrom=${dateFrom}&dateTo=${dateTo}`),
        authFetch(`/api/benchmarks/performance?dateFrom=${dateFrom}&dateTo=${dateTo}`),
        authFetch('/api/benchmarks/score'),
      ]);

      const compData = compRes.ok ? await compRes.json() : null;
      const benchData = benchRes.ok ? await benchRes.json() : null;
      const scoreData = scoreRes.ok ? await scoreRes.json() : null;

      if (!compData && !benchData) {
        setData(null);
      } else {
        const rows: NetworkRow[] = NETWORKS.map(networkId => {
          const comp = compData?.networks?.find((n: { networkId: string }) => n.networkId === networkId);
          const bench = benchData?.networks?.find((n: { networkId: string }) => n.networkId === networkId);
          return {
            networkId,
            actual: comp?.[metric] ?? null,
            historicalAvg: bench?.historical?.[metric] ?? null,
            industryBenchmark: bench?.industry?.[metric] ?? null,
            lastSyncStatus: comp?.lastSyncStatus ?? null,
            circuitBreakerOpen: comp?.circuitBreakerOpen ?? false,
          };
        });

        const trend: TrendPoint[] = (benchData?.trend ?? []).map((p: { date: string; actual: number | null; historicalAvg: number | null }) => ({
          date: p.date,
          actual: p.actual,
          historicalAvg: p.historicalAvg,
        }));

        setData({ score: scoreData?.score ?? null, rows, trend });
      }
      setLoaded(true);
    } catch {
      setError('Failed to load benchmark data.');
    } finally {
      setLoading(false);
    }
  }, [loaded, loading, dateFrom, dateTo, metric]);

  // Trigger load on first render of this component (lazy)
  if (!loaded && !loading && !error) {
    load();
  }

  // Recompute row data when metric changes (without refetching)
  // rows already depend on metric in the load function above;
  // for metric toggle after load we just use the stored data and re-derive

  const isEmpty = loaded && !loading && !error && (!data || data.rows.every(r => r.actual === null));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Performance Benchmarking</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Compare your network metrics against historical and industry benchmarks.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {loading ? <ShimmerGauge /> : <ScoreGauge score={data?.score ?? null} />}
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Benchmark Settings
          </button>
        </div>
      </div>

      {/* Metric Toggle */}
      <div className="flex flex-wrap gap-1 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 p-1">
        {METRICS.map(m => (
          <button
            key={m.id}
            onClick={() => setMetric(m.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              metric === m.id
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Empty */}
      {isEmpty && (
        <div className="py-12 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            No data for this date range. Sync your networks to see benchmark comparisons.
          </p>
          <a
            href="#sync"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            Sync Now →
          </a>
        </div>
      )}

      {/* KPI Table */}
      {!isEmpty && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Network</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Actual</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Hist. Avg</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Industry Target</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">vs Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {loading
                  ? NETWORKS.map(n => (
                      <tr key={n}>
                        <td colSpan={5} className="px-4 py-3">
                          <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                        </td>
                      </tr>
                    ))
                  : (data?.rows ?? []).map(row => {
                      const color = rowColor(row.actual, row.industryBenchmark);
                      const warn = row.lastSyncStatus === 'failed' || row.circuitBreakerOpen;
                      return (
                        <tr key={row.networkId} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">
                            <div className="flex items-center gap-2">
                              {NETWORK_LABELS[row.networkId]}
                              {warn && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-600 dark:text-amber-400">
                                  <AlertTriangle className="w-3 h-3" />
                                  Sync issue
                                </span>
                              )}
                            </div>
                          </td>
                          <td className={`px-4 py-3 text-right font-mono ${color}`}>
                            {fmt(row.actual, metric)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-400">
                            {fmt(row.historicalAvg, metric)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-400">
                            {fmt(row.industryBenchmark, metric)}
                          </td>
                          <td className="px-4 py-3">
                            <MetricShareBar actual={row.actual} benchmark={row.industryBenchmark} />
                          </td>
                        </tr>
                      );
                    })
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Trend sparkline */}
      {!isEmpty && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
            30-Day Trend — {METRICS.find(m => m.id === metric)?.label}
          </h3>
          {loading ? (
            <div className="h-28 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
          ) : (data?.trend ?? []).length > 0 ? (
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={data!.trend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} hide />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={36} />
                <Tooltip
                  contentStyle={{ fontSize: 12 }}
                  formatter={(val) => [val !== null ? String(Number(val).toFixed(2)) : '—', '']}
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="actual"
                  name="Actual"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="historicalAvg"
                  name="Hist. Avg"
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-28 flex items-center justify-center text-xs text-gray-400">No trend data</div>
          )}
        </div>
      )}

      {settingsOpen && (
        <BenchmarkSettingsModal
          onClose={() => setSettingsOpen(false)}
          onSaved={() => {}}
        />
      )}
    </div>
  );
}
