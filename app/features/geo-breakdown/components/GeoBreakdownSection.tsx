'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ShieldAlert, AlertTriangle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useDateRangeStore } from '@/store/dateRangeStore';
import { useDashboardStore } from '@/store/dashboardStore';
import type { GeoCountryRow, MetricToggle, TopNOption } from '../types';
import GeoColorRow from './GeoColorRow';
import MetricShareBar from './MetricShareBar';
import GeoInsightsStrip from './GeoInsightsStrip';
import GeoTableSkeleton from './GeoTableSkeleton';
import NetworkSubRow from './NetworkSubRow';
import GeoCountryDrilldownModal from './GeoCountryDrilldownModal';
import { useGeoBreakdown } from '../hooks/useGeoBreakdown';
import { Toast } from '@/components/ui/Toast';
import MobileDataTableWrapper from '@/components/layout/MobileDataTableWrapper';
import type { ColumnConfig } from '@/components/layout/MobileDataTableWrapper';

function formatCurrency(value: number | null): string {
  if (value === null) return '—';
  return `$${value.toFixed(2)}`;
}

function formatNumber(value: number | null): string {
  if (value === null) return '—';
  return value.toLocaleString();
}

function formatRoi(value: number | null): string {
  if (value === null) return '—';
  return `${value.toFixed(1)}%`;
}

const TOP_N_OPTIONS: TopNOption[] = [10, 20, 50];
const METRIC_OPTIONS: MetricToggle[] = ['Revenue', 'Cost', 'Profit'];

export default function GeoBreakdownSection() {
  const router = useRouter();
  const { fromDate, toDate, setPreset } = useDateRangeStore();
  const { countries, loading, errorType, roiFailed, sessionExpired, accessDenied, refresh } = useGeoBreakdown(fromDate, toDate);
  const { filters } = useDashboardStore();

  useEffect(() => {
    if (sessionExpired) {
      router.replace('/');
    }
  }, [sessionExpired, router]);
  const [metric, setMetric] = useState<MetricToggle>('Profit');
  const [topN, setTopN] = useState<TopNOption>(10);
  const [search, setSearch] = useState('');
  const [expandedNetworks, setExpandedNetworks] = useState<Set<string>>(new Set());
  const [drilldownCountry, setDrilldownCountry] = useState<GeoCountryRow | null>(null);

  // Use store searchQuery (from FilterToolbar) if present, otherwise fall back to local search
  const activeSearch = filters.searchQuery || search;

  const sortedAndFiltered = useMemo(() => {
    const filtered = countries.filter(c =>
      !activeSearch ||
      c.countryName.toLowerCase().includes(activeSearch.toLowerCase()) ||
      c.countryCode.toLowerCase().includes(activeSearch.toLowerCase())
    );
    const sorted = [...filtered].sort((a, b) => {
      if (metric === 'Revenue') return (b.revenue ?? -Infinity) - (a.revenue ?? -Infinity);
      if (metric === 'Cost') return (b.cost ?? -Infinity) - (a.cost ?? -Infinity);
      return (b.netProfit ?? -Infinity) - (a.netProfit ?? -Infinity);
    });
    return sorted.slice(0, topN);
  }, [countries, metric, topN, activeSearch]);

  const insights = useMemo(() => {
    const withProfit = countries.filter(c => c.netProfit !== null);
    const sorted = [...withProfit].sort((a, b) => (b.netProfit ?? 0) - (a.netProfit ?? 0));
    return {
      topCountry: sorted[0] ?? null,
      worstCountry: sorted[sorted.length - 1] ?? null,
      positiveRoiCount: countries.filter(c => (c.roi ?? 0) > 0).length,
      totalCountries: countries.length,
    };
  }, [countries]);

  const toggleNetworkExpand = (countryCode: string) => {
    setExpandedNetworks(prev => {
      const next = new Set(prev);
      if (next.has(countryCode)) next.delete(countryCode);
      else next.add(countryCode);
      return next;
    });
  };

  const geoTableColumns: ColumnConfig[] = [
    { key: 'countryName', label: 'Country', visibility: 'primary',
      render: row => `${row.flagEmoji ?? ''} ${row.countryName ?? row.countryCode}` },
    { key: 'netProfit', label: 'Net Profit', visibility: 'primary',
      render: row => formatCurrency(row.netProfit as number | null) },
    { key: 'revenue', label: 'Revenue', visibility: 'secondary',
      render: row => formatCurrency(row.revenue as number | null) },
    { key: 'cost', label: 'Cost', visibility: 'secondary',
      render: row => formatCurrency(row.cost as number | null) },
    { key: 'roi', label: 'ROI%', visibility: 'secondary',
      render: row => formatRoi(row.roi as number | null) },
    { key: 'impressions', label: 'Impressions', visibility: 'secondary',
      render: row => formatNumber(row.impressions as number | null) },
    { key: 'clicks', label: 'Clicks', visibility: 'secondary',
      render: row => formatNumber(row.clicks as number | null) },
  ];

  // ─── Loading: full skeleton including header ─────────────────────────────────
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex flex-wrap items-center gap-3 animate-pulse">
          <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-7 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div className="h-7 w-20 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div className="h-7 flex-1 min-w-[150px] bg-gray-200 dark:bg-gray-700 rounded-lg" />
        </div>
        <GeoTableSkeleton />
      </div>
    );
  }

  return (
    <>
    {sessionExpired && <Toast message="Session expired. Please sign in again." />}
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex-shrink-0">
          Geographic Breakdown
        </h2>

        {/* Metric toggle */}
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 gap-0.5">
          {METRIC_OPTIONS.map(m => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                metric === m
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Top N selector */}
        <select
          value={topN}
          onChange={e => setTopN(Number(e.target.value) as TopNOption)}
          className="text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none"
        >
          {TOP_N_OPTIONS.map(n => (
            <option key={n} value={n}>Top {n}</option>
          ))}
        </select>

        {/* Search */}
        <div className="relative flex-1 min-w-[150px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search countries..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Content */}
      {accessDenied ? (
        <div className="flex items-center gap-2 p-4 text-sm text-red-700 dark:text-red-400">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">Access Denied — you don&apos;t have permission to view geographic data.</span>
          <Link href="/dashboard" className="text-xs underline flex-shrink-0">Dashboard</Link>
        </div>
      ) : errorType === 'error_500' ? (
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">Unable to load geographic data.</span>
          <button onClick={refresh} className="text-xs underline flex-shrink-0">Retry</button>
        </div>
      ) : errorType === 'error_404' ? (
        <div className="flex flex-col items-center p-8 text-center gap-3">
          <AlertCircle className="w-5 h-5 text-gray-400" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No geographic data found for selected range.
          </p>
          <button
            onClick={() => setPreset('last7')}
            className="text-xs text-blue-600 dark:text-blue-400 underline"
          >
            Reset to last 7 days
          </button>
        </div>
      ) : countries.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            No geographic data for this date range. Sync your networks to see country breakdowns.
          </p>
          <a
            href="#sync"
            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            Sync Now
          </a>
        </div>
      ) : (
        <>
          {/* ROI partial failure warning */}
          {roiFailed && (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              ROI color coding unavailable.
            </div>
          )}

          {/* Mobile card view */}
          <div className="md:hidden p-3 space-y-2">
            <MobileDataTableWrapper
              columns={geoTableColumns}
              rows={sortedAndFiltered as unknown as Record<string, unknown>[]}
              rowKey="countryCode"
            />
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Country</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Revenue</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Cost</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Net Profit</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">ROI%</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Impressions</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Clicks</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {sortedAndFiltered.map(row => (
                  <>
                    <GeoColorRow
                      key={row.countryCode}
                      colorCode={row.colorCode}
                      className="cursor-pointer hover:opacity-90 transition-opacity"
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              toggleNetworkExpand(row.countryCode);
                            }}
                            className="text-gray-400 hover:text-gray-600 text-xs leading-none"
                            aria-label="Toggle network breakdown"
                            title="Network breakdown"
                          >
                            {expandedNetworks.has(row.countryCode) ? '▼' : '▶'}
                          </button>
                          <button
                            onClick={() => setDrilldownCountry(row)}
                            className="flex items-center gap-1.5 text-left hover:underline"
                          >
                            <span>{row.flagEmoji}</span>
                            <span className="font-medium">{row.countryName}</span>
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right">{formatCurrency(row.revenue)}</td>
                      <td className="px-3 py-2.5 text-right">{formatCurrency(row.cost)}</td>
                      <td className="px-3 py-2.5 text-right font-medium">{formatCurrency(row.netProfit)}</td>
                      <td className="px-3 py-2.5 text-right">{formatRoi(row.roi)}</td>
                      <td className="px-3 py-2.5 text-right">{formatNumber(row.impressions)}</td>
                      <td className="px-3 py-2.5 text-right">{formatNumber(row.clicks)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs">{row.metricShare.toFixed(1)}%</span>
                          <MetricShareBar value={row.metricShare} />
                        </div>
                      </td>
                    </GeoColorRow>
                    {expandedNetworks.has(row.countryCode) && (
                      <NetworkSubRow
                        key={`${row.countryCode}-networks`}
                        contributions={[]}
                      />
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          <GeoInsightsStrip
            topCountry={insights.topCountry}
            worstCountry={insights.worstCountry}
            positiveRoiCount={insights.positiveRoiCount}
            totalCountries={insights.totalCountries}
          />
        </>
      )}

      {/* Drilldown Modal */}
      {drilldownCountry && (
        <GeoCountryDrilldownModal
          countryCode={drilldownCountry.countryCode}
          countryName={drilldownCountry.countryName}
          flagEmoji={drilldownCountry.flagEmoji}
          onClose={() => setDrilldownCountry(null)}
        />
      )}
    </div>
    </>
  );
}
