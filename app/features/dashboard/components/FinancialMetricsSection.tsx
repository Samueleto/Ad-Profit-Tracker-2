'use client';

import { useState } from 'react';
import { getAuth } from 'firebase/auth';
import { TrendingUp, TrendingDown, Minus, RefreshCw, Loader2, Download } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';
import { format } from 'date-fns';
import DailyProfitTrendSection from './DailyProfitTrendSection';
import { useDashboardMetrics } from '../hooks/useDashboardMetrics';
import type { Preset } from '../hooks/useDashboardMetrics';

// ─── Auth helper (used by ROICard only for its per-network breakdown) ─────────
async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken();
  return fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

// ─── KPI card ─────────────────────────────────────────────────────────────────
function KPICard({
  label, value, change, format: fmt,
}: { label: string; value: number | null; change: number | null; format: 'currency' | 'percent' }) {
  const fmtVal = (v: number | null): string => {
    if (v === null || v === undefined) return '—';
    if (fmt === 'currency') return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `${v.toFixed(1)}%`;
  };

  const changeColor = change == null ? 'text-amber-500'
    : change > 0 ? 'text-green-600 dark:text-green-400'
    : change < 0 ? 'text-red-500'
    : 'text-amber-500';
  const ChangeIcon = change == null ? Minus : change > 0 ? TrendingUp : TrendingDown;

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{fmtVal(value)}</p>
      {change !== null && change !== undefined && (
        <div className={`flex items-center gap-1 mt-1 text-xs ${changeColor}`}>
          <ChangeIcon className="w-3.5 h-3.5" />
          <span>{change > 0 ? '+' : ''}{change.toFixed(1)}% vs prior</span>
        </div>
      )}
    </div>
  );
}

// ─── Freshness badge ──────────────────────────────────────────────────────────
function FreshnessBadge({ type, minutesAgo }: { type: 'live' | 'cached'; minutesAgo?: number }) {
  if (type === 'live') {
    return <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">Live</span>;
  }
  return (
    <span className="px-2 py-0.5 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full">
      Cached · {minutesAgo}m ago
    </span>
  );
}

// ─── ROI card ─────────────────────────────────────────────────────────────────
interface ROICardProps {
  roi: number | null;
  roiChange: number | null;
  kpis: KPIs;
  dateFrom: string;
  dateTo: string;
  loading: boolean;
}

function ROICard({ roi, roiChange, kpis, dateFrom, dateTo, loading }: ROICardProps) {
  const [roiBreakdownOpen, setRoiBreakdownOpen] = useState(false);
  const [networkRows, setNetworkRows] = useState<Array<{ networkId: string; yield: number }>>([]);
  const [breakdownLoading, setBreakdownLoading] = useState(false);

  useEffect(() => {
    if (!dateFrom || !dateTo) return;
    setBreakdownLoading(true);
    const params = new URLSearchParams({ dimension: 'network', dateFrom, dateTo });
    authFetch(`/api/roi/breakdown?${params}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setNetworkRows(d.rows ?? d.networks ?? []); })
      .catch(() => {})
      .finally(() => setBreakdownLoading(false));
  }, [dateFrom, dateTo]);

  if (loading) {
    return (
      <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
    );
  }

  const isNull = roi === null || roi === undefined;
  const isPositive = !isNull && roi > 0;
  const isNegative = !isNull && roi < 0;

  const cardBg = isNull ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
    : isPositive ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
    : isNegative ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
    : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800';

  const textColor = isNull ? 'text-amber-600 dark:text-amber-400'
    : isPositive ? 'text-green-700 dark:text-green-400'
    : isNegative ? 'text-red-600 dark:text-red-400'
    : 'text-amber-600 dark:text-amber-400';

  const arrow = isNull ? '→' : isPositive ? '↑' : isNegative ? '↓' : '→';

  const formulaRevenue = kpis.totalRevenue ?? 0;
  const formulaCost = kpis.totalCost ?? 0;
  const formulaProfit = formulaRevenue - formulaCost;
  const formulaROI = formulaCost > 0 ? (formulaProfit / formulaCost * 100).toFixed(2) : 'N/A';

  return (
    <div className={`border rounded-xl p-4 space-y-3 ${cardBg}`}>
      <p className="text-xs text-gray-500 dark:text-gray-400">ROI</p>
      <div className="flex items-center gap-2">
        <span className={`text-3xl font-black ${textColor}`}>
          {isNull ? 'N/A' : `${roi.toFixed(2)}%`}
        </span>
        <span className={`text-xl ${textColor}`} title={isNull ? 'No cost data available for this period' : undefined}>
          {arrow}
        </span>
      </div>
      {!isNull && roiChange !== null && (
        <p className={`text-xs ${textColor}`}>
          {roiChange > 0 ? '+' : ''}{roiChange.toFixed(1)}% vs prior period
        </p>
      )}
      {isNull && (
        <span className="inline-block px-2 py-0.5 text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-full" title="No cost data available for this period">
          No cost data
        </span>
      )}

      {/* Per-network breakdown rows */}
      {breakdownLoading ? (
        <div className="animate-pulse h-12 bg-white/50 dark:bg-black/10 rounded" />
      ) : networkRows.length > 0 ? (
        <div className="space-y-1">
          {networkRows.filter(n => ['rollerads', 'zeydoo', 'propush'].includes(n.networkId)).map(n => (
            <div key={n.networkId} className="flex justify-between text-xs">
              <span className="capitalize text-gray-600 dark:text-gray-400">{n.networkId}</span>
              <span className={n.yield >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}>
                {n.yield.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {/* Collapsible formula */}
      <button onClick={() => setRoiBreakdownOpen(p => !p)}
        className={`text-xs underline ${textColor}`}>
        {roiBreakdownOpen ? 'Hide' : 'ROI Breakdown'} ▾
      </button>
      {roiBreakdownOpen && (
        <div className="bg-white/60 dark:bg-black/20 rounded-lg px-3 py-2 text-xs text-gray-700 dark:text-gray-300 font-mono">
          ({formulaRevenue.toFixed(2)} − {formulaCost.toFixed(2)}) / {formulaCost.toFixed(2)} × 100 = <strong>{formulaROI}%</strong>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
interface FinancialMetricsSectionProps {
  onSyncNow?: () => void;
  onExport?: () => void;
}

export default function FinancialMetricsSection({ onSyncNow, onExport }: FinancialMetricsSectionProps) {
  const {
    status,
    kpis,
    dailySeries,
    topCountries,
    perNetwork,
    freshness,
    dateRange,
    setDateRange,
    refresh,
    dateRangeValidationError,
  } = useDashboardMetrics();

  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const preset = dateRange.preset;

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await refresh(); } finally { setRefreshing(false); }
  };

  const handleCustomFrom = (v: string) => {
    setCustomFrom(v);
    if (customTo) setDateRange('custom', { dateFrom: v, dateTo: customTo });
  };

  const handleCustomTo = (v: string) => {
    setCustomTo(v);
    if (customFrom) setDateRange('custom', { dateFrom: customFrom, dateTo: v });
  };

  const loading = status === 'loading';
  const fetchError = status === 'error';
  const isEmpty = status === 'empty';
  const data = status === 'success' ? { kpis, dailySeries, topCountries, perNetwork } : null;

  return (
    <div className="space-y-6">
      {/* Sticky date bar */}
      <div className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-950 py-2 -mx-4 px-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1">
            {([
              { id: '7d', label: 'Last 7' },
              { id: '14d', label: 'Last 14' },
              { id: '30d', label: 'Last 30' },
              { id: 'month', label: 'This Month' },
              { id: 'custom', label: 'Custom' },
            ] as const).map(p => (
              <button key={p.id} onClick={() => setDateRange(p.id as Preset)}
                className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                  preset === p.id
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >{p.label}</button>
            ))}
          </div>

          {preset === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" value={customFrom} onChange={e => handleCustomFrom(e.target.value)}
                className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white" />
              <span className="text-xs text-gray-400">–</span>
              <input type="date" value={customTo} onChange={e => handleCustomTo(e.target.value)}
                className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white" />
              {dateRangeValidationError && <span className="text-xs text-red-500">{dateRangeValidationError}</span>}
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            <FreshnessBadge type={freshness.type} minutesAgo={freshness.minutesAgo} />
            <button onClick={handleRefresh} disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors">
              {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Refresh Data
            </button>
            {onExport && (
              <button onClick={onExport}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <Download className="w-3.5 h-3.5" /> Export
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            ))}
          </div>
          <div className="h-48 bg-gray-100 dark:bg-gray-800 rounded-xl" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded" />)}
            </div>
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded" />)}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="text-center py-16">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            No data for this date range. Try syncing your networks first.
          </p>
          <button onClick={onSyncNow}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
            Sync Now
          </button>
        </div>
      )}

      {/* Error state */}
      {fetchError && (
        <div className="text-center py-10">
          <p className="text-sm text-red-500 mb-2">Failed to load dashboard metrics.</p>
          <button onClick={handleRefresh} className="text-xs text-blue-600 underline">Retry</button>
        </div>
      )}

      {/* Success state */}
      {!loading && !fetchError && data && !isEmpty && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard label="Total Revenue" value={data.kpis.totalRevenue} change={data.kpis.revenueChange} format="currency" />
            <KPICard label="Total Cost" value={data.kpis.totalCost} change={data.kpis.costChange} format="currency" />
            <KPICard label="Net Profit" value={data.kpis.netProfit} change={data.kpis.profitChange} format="currency" />
            <ROICard roi={data.kpis.roi} roiChange={data.kpis.roiChange} kpis={data.kpis} dateFrom={dateRange.dateFrom} dateTo={dateRange.dateTo} loading={false} />
          </div>

          {/* Daily Profit Trend — dedicated section with metric toggle */}
          <DailyProfitTrendSection onSyncNow={onSyncNow} />

          {/* Trend chart (period overview) */}
          {data.dailySeries?.length > 0 && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Daily Profit Trend</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.dailySeries} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }}
                      tickFormatter={v => { try { return format(new Date(v), 'MMM d'); } catch { return v; } }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(value, name) => [`$${Number(value).toFixed(2)}`, name as string]}
                      labelFormatter={l => { try { return format(new Date(l), 'MMM d, yyyy'); } catch { return l; } }}
                    />
                    <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="4 2" strokeWidth={1} label={{ value: 'Breakeven', position: 'insideTopRight', fontSize: 9, fill: '#9ca3af' }} />
                    <Line type="monotone" dataKey="netProfit" stroke="#3b82f6" dot={false} name="Net Profit" strokeWidth={2} />
                    <Line type="monotone" dataKey="revenue" stroke="#10b981" dot={false} name="Revenue" strokeWidth={1} strokeDasharray="4 2" />
                    <Line type="monotone" dataKey="cost" stroke="#ef4444" dot={false} name="Cost" strokeWidth={1} strokeDasharray="4 2" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Two-column split */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* GEO breakdown */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Top Countries by Net Profit</h3>
              {data.topCountries?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-800">
                        {['Country', 'Revenue', 'Cost', 'Net Profit', 'Share'].map(h => (
                          <th key={h} className="pb-2 text-left font-medium text-gray-500 dark:text-gray-400 pr-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                      {[...data.topCountries].sort((a, b) => b.netProfit - a.netProfit).slice(0, 10).map(row => (
                        <tr key={row.country}>
                          <td className="py-2 pr-3 text-gray-900 dark:text-gray-100">{row.countryName ?? row.country}</td>
                          <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">${row.revenue.toFixed(2)}</td>
                          <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">${row.cost.toFixed(2)}</td>
                          <td className={`py-2 pr-3 font-medium ${row.netProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                            ${row.netProfit.toFixed(2)}
                          </td>
                          <td className="py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(row.metricShare, 100)}%` }} />
                              </div>
                              <span className="text-gray-500">{row.metricShare.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">No country data.</p>
              )}
            </div>

            {/* Per-network summary */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Per-Network Summary</h3>
              {data.perNetwork?.length > 0 ? (
                <div className="space-y-3">
                  {data.perNetwork.map(net => (
                    <div key={net.networkId} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">{net.networkId}</p>
                        {net.lastSyncAt && (
                          <p className="text-xs text-gray-400">
                            Synced: {format(new Date(net.lastSyncAt), 'MMM d, HH:mm')}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          ${Number(net.primaryMetric).toFixed(2)}
                        </p>
                        {net.syncStatus && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            net.syncStatus === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : net.syncStatus === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          }`}>{net.syncStatus}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">No network data.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
