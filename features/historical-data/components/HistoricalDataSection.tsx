'use client';

import { useState, useCallback, useRef } from 'react';
import { Loader2, AlertCircle, Trash2, RefreshCw, ChevronDown } from 'lucide-react';
import { useRateLimitStatus } from '@/features/rate-limits/hooks';

interface UserQuota { endpoint: string; remaining: number; resetAt: string | null; }
function findQuota(qs: unknown[], ep: string) { return (qs as UserQuota[]).find(q => q.endpoint === ep); }
function quotaEmpty(q: UserQuota | undefined) { return q != null && q.remaining === 0; }
function resetTime(q: UserQuota | undefined) { return q?.resetAt ? new Date(q.resetAt).toLocaleTimeString() : 'soon'; }
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Toast } from '@/components/ui/Toast';
import {
  useDates,
  useSnapshot,
  useTrend,
  useSummary,
  useGeoBreakdown,
  useCoverage,
  useBackfill,
  useDeleteSnapshot,
} from '@/features/stats/hooks/useStats';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 13);
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}

const METRIC_OPTIONS = ['revenue', 'cost', 'profit', 'roi', 'impressions', 'clicks'] as const;
type Metric = typeof METRIC_OPTIONS[number];

const NETWORK_OPTIONS = ['', 'exoclick', 'rollerads', 'zeydoo', 'propush'] as const;
type NetworkOption = typeof NETWORK_OPTIONS[number];

// ─── DateAvailabilityCalendar ─────────────────────────────────────────────────

interface DateEntry {
  date: string;
  isComplete: boolean;
  networks?: string[];
}

interface DateCalendarProps {
  dates: DateEntry[];
  selectedDate: string;
  onSelect: (date: string) => void;
}

function DateCalendarStrip({ dates, selectedDate, onSelect }: DateCalendarProps) {
  const dateSet: Record<string, DateEntry> = {};
  dates.forEach(d => { dateSet[d.date] = d; });

  return (
    <div className="flex flex-wrap gap-1">
      {dates.map(entry => {
        const isSelected = entry.date === selectedDate;
        const dot = entry.isComplete
          ? 'bg-green-500'
          : entry.networks && entry.networks.length > 0
          ? 'bg-amber-400'
          : 'bg-gray-300 dark:bg-gray-600';
        return (
          <button
            key={entry.date}
            onClick={() => onSelect(entry.date)}
            title={entry.date + (entry.isComplete ? ' — complete' : ' — partial')}
            className={`relative flex flex-col items-center px-2 py-1.5 rounded-lg text-xs transition-colors ${
              isSelected
                ? 'bg-blue-600 text-white'
                : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {entry.date.slice(5)}
            <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isSelected ? 'bg-white' : dot}`} />
          </button>
        );
      })}
    </div>
  );
}

// ─── CoverageMap ──────────────────────────────────────────────────────────────

interface CoverageEntry {
  date: string;
  missingNetworks: string[];
  hasSyncErrors?: boolean;
}

function CoverageMap({ entries }: { entries: CoverageEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-xs text-gray-500 dark:text-gray-400 py-2">No coverage data for this period.</p>;
  }
  const gaps = entries.filter(e => e.missingNetworks?.length > 0);
  if (gaps.length === 0) {
    return <p className="text-xs text-green-600 dark:text-green-400 py-2">Full coverage — all networks have data for this period.</p>;
  }
  return (
    <div className="space-y-1">
      {gaps.map(e => (
        <div key={e.date} className="flex items-center gap-2 text-xs">
          <span className="text-amber-500">⚠</span>
          <span className="font-mono text-gray-700 dark:text-gray-300">{e.date}</span>
          <span className="text-gray-500 dark:text-gray-400">missing: {e.missingNetworks.join(', ')}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function HistoricalDataSection() {
  const init = defaultRange();
  const [dateFrom, setDateFrom] = useState(init.from);
  const [dateTo, setDateTo] = useState(init.to);
  const [selectedDate, setSelectedDate] = useState(init.to);
  const [networkFilter, setNetworkFilter] = useState<NetworkOption>('');
  const [groupBy, setGroupBy] = useState<'country' | 'total'>('total');
  const [metric, setMetric] = useState<Metric>('revenue');
  const [geoLimit, setGeoLimit] = useState(10);
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  // ─── Hooks ──────────────────────────────────────────────────────────────────

  const { data: datesData, loading: datesLoading } = useDates(networkFilter || undefined, dateFrom, dateTo);
  const dates: DateEntry[] = (datesData as { dates?: DateEntry[] })?.dates ?? [];

  const { data: snapshotData, loading: snapshotLoading, error: snapshotError } = useSnapshot(
    selectedDate,
    networkFilter || undefined,
    groupBy,
  );

  const { data: trendData, loading: trendLoading, error: trendError } = useTrend(
    dateFrom,
    dateTo,
    networkFilter || undefined,
    metric,
  );

  const { data: summaryData, loading: summaryLoading } = useSummary(dateFrom, dateTo);

  const { data: geoData, loading: geoLoading } = useGeoBreakdown(
    dateFrom,
    dateTo,
    networkFilter || undefined,
    metric,
    geoLimit,
  );

  const { data: coverageData, loading: coverageLoading, error: coverageError } = useCoverage(
    dateFrom,
    dateTo,
    networkFilter || undefined,
  );
  const coverageEntries: CoverageEntry[] = (coverageData as { gaps?: CoverageEntry[] })?.gaps ?? [];

  const backfill = useBackfill();
  const deleteSnap = useDeleteSnapshot();
  const { userQuotas } = useRateLimitStatus();
  const backfillQuota = findQuota(userQuotas, '/api/stats/backfill');
  const backfillBlocked = quotaEmpty(backfillQuota);

  // ─── Invalidation refs ──────────────────────────────────────────────────────
  // Re-mount coverage/dates by toggling a key after backfill/delete
  const [refreshKey, setRefreshKey] = useState(0);
  const refreshAll = useCallback(() => setRefreshKey(k => k + 1), []);

  const handleBackfill = useCallback(async () => {
    await backfill.trigger(dateFrom, dateTo, networkFilter || undefined);
    if (backfill.error) {
      setToast({ message: backfill.error, variant: 'error' });
    } else if (backfill.data) {
      const { triggered, skipped, failed } = backfill.data;
      setToast({
        message: `Backfill: ${triggered.length} triggered, ${skipped.length} skipped, ${failed.length} failed.`,
        variant: failed.length > 0 ? 'error' : 'success',
      });
      refreshAll();
      backfill.reset();
    }
  }, [backfill, dateFrom, dateTo, networkFilter, refreshAll]);

  const handleDelete = useCallback(async (date: string) => {
    await deleteSnap.trigger(date, networkFilter || undefined);
    setDeleteConfirm(null);
    if (deleteSnap.error) {
      setToast({ message: deleteSnap.error, variant: 'error' });
    } else {
      setToast({ message: `Deleted ${deleteSnap.deletedCount ?? 0} snapshot entries for ${date}.`, variant: 'success' });
      refreshAll();
      deleteSnap.reset();
    }
  }, [deleteSnap, networkFilter, refreshAll]);

  const snapshot = snapshotData as Record<string, unknown> | null;
  const trend = trendData as { rows?: Record<string, unknown>[]; metadata?: { movingAverage7d?: number[] } } | null;
  const summary = summaryData as { perNetwork?: Record<string, unknown>[]; dateFrom?: string; dateTo?: string } | null;
  const geo = geoData as { countries?: Record<string, unknown>[] } | null;

  return (
    <>
      {toast && <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        {/* Collapsible header */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Historical Data Explorer
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>

        {expanded && (
          <div className="border-t border-gray-100 dark:border-gray-800 p-4 space-y-5">
            {/* Controls row */}
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs text-gray-500 mb-1">From</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">To</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Network</label>
                <select value={networkFilter} onChange={e => setNetworkFilter(e.target.value as NetworkOption)}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white">
                  <option value="">All</option>
                  {NETWORK_OPTIONS.slice(1).map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>

            {/* Date availability calendar */}
            <div>
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
                Data Availability
                <span className="ml-2 font-normal text-gray-400 dark:text-gray-500">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-0.5" />complete
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-400 mx-1" />partial
                  <span className="inline-block w-2 h-2 rounded-full bg-gray-300 ml-0.5 mr-1" />missing
                </span>
              </p>
              {datesLoading ? (
                <div className="h-10 animate-pulse bg-gray-100 dark:bg-gray-800 rounded-lg" />
              ) : (
                <DateCalendarStrip dates={dates} selectedDate={selectedDate} onSelect={setSelectedDate} />
              )}
            </div>

            {/* Snapshot view */}
            <div key={`snapshot-${refreshKey}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Snapshot — {selectedDate}</p>
                <div className="flex gap-1">
                  {(['total', 'country'] as const).map(g => (
                    <button key={g} onClick={() => setGroupBy(g)}
                      className={`px-2 py-0.5 text-xs rounded-lg border transition-colors ${
                        groupBy === g ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                      }`}>
                      {g === 'total' ? 'Total' : 'By Country'}
                    </button>
                  ))}
                  <button
                    onClick={() => setDeleteConfirm(selectedDate)}
                    className="ml-2 p-1 text-gray-400 hover:text-red-500 transition-colors"
                    title="Delete snapshot"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {deleteConfirm === selectedDate && (
                <div className="flex items-center gap-2 p-2 mb-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-xs text-red-700 dark:text-red-400">
                  Delete snapshot for {selectedDate}?
                  <button onClick={() => handleDelete(selectedDate)} disabled={deleteSnap.loading}
                    className="px-2 py-0.5 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50">
                    {deleteSnap.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirm'}
                  </button>
                  <button onClick={() => setDeleteConfirm(null)} className="underline">Cancel</button>
                </div>
              )}

              {snapshotLoading && <div className="h-16 animate-pulse bg-gray-100 dark:bg-gray-800 rounded-lg" />}
              {snapshotError && <p className="text-xs text-red-500">{snapshotError}</p>}
              {!snapshotLoading && snapshot && (
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                  <pre className="text-xs p-3 font-mono text-gray-700 dark:text-gray-300 max-h-40 overflow-auto">
                    {JSON.stringify(snapshot, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Trend chart */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Trend</p>
                <select value={metric} onChange={e => setMetric(e.target.value as Metric)}
                  className="px-2 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white capitalize">
                  {METRIC_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              {trendLoading && <div className="h-40 animate-pulse bg-gray-100 dark:bg-gray-800 rounded-lg" />}
              {trendError && <p className="text-xs text-red-500">{trendError}</p>}
              {!trendLoading && trend?.rows && trend.rows.length > 0 && (
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trend.rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 9 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey={metric} stroke="#3b82f6" dot={false} name={metric} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Summary panel */}
            {!summaryLoading && summary?.perNetwork && summary.perNetwork.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Summary by Network</p>
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                        {['Network', 'Revenue', 'Cost', 'Last Synced', 'Status'].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {(summary.perNetwork as Array<Record<string, unknown>>).map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{String(row.networkId ?? '—')}</td>
                          <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{row.revenue != null ? `$${Number(row.revenue).toFixed(2)}` : '—'}</td>
                          <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{row.cost != null ? `$${Number(row.cost).toFixed(2)}` : '—'}</td>
                          <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{row.lastSyncedAt ? new Date(String(row.lastSyncedAt)).toLocaleDateString() : '—'}</td>
                          <td className="px-3 py-2">
                            {row.lastSyncStatus === 'success'
                              ? <span className="text-green-600 dark:text-green-400">✓</span>
                              : row.lastSyncStatus === 'failed'
                              ? <span className="text-red-500">✗</span>
                              : <span className="text-gray-400">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Geo breakdown */}
            {!geoLoading && geo?.countries && geo.countries.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Geo Breakdown</p>
                  <select value={geoLimit} onChange={e => setGeoLimit(Number(e.target.value))}
                    className="px-2 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white">
                    {[10, 25, 50].map(n => <option key={n} value={n}>Top {n}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  {(geo.countries as Array<Record<string, unknown>>).slice(0, geoLimit).map((row, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="w-16 text-gray-700 dark:text-gray-300 truncate">{String(row.countryCode ?? '?')}</span>
                      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${Math.min(Number(row.metricShare ?? row.revenueShare ?? 0), 100)}%` }} />
                      </div>
                      <span className="text-gray-500 w-10 text-right">
                        {Number(row.metricShare ?? row.revenueShare ?? 0).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Coverage map */}
            <div key={`coverage-${refreshKey}`}>
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Coverage Gaps</p>
              {coverageLoading && <div className="h-8 animate-pulse bg-gray-100 dark:bg-gray-800 rounded-lg" />}
              {coverageError && <p className="text-xs text-red-500">{coverageError}</p>}
              {!coverageLoading && !coverageError && <CoverageMap entries={coverageEntries} />}
            </div>

            {/* Backfill trigger */}
            <div className="flex items-center gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={handleBackfill}
                disabled={backfill.loading || backfillBlocked}
                title={backfillBlocked ? `Quota reached — resets at ${resetTime(backfillQuota)}` : undefined}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
              >
                {backfill.loading
                  ? <><Loader2 className="w-3 h-3 animate-spin" /> Backfilling…</>
                  : backfillBlocked ? 'Quota reached'
                  : <><RefreshCw className="w-3 h-3" /> Re-sync / Backfill</>}
              </button>
              {backfillBlocked && backfillQuota?.resetAt && (
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  Quota reached — resets at {resetTime(backfillQuota)}
                </span>
              )}
              {backfill.error && (
                <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {backfill.error}
                </span>
              )}
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Triggers a sync for all missing data in the selected date range.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
