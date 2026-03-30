'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, AlertCircle, RefreshCw, ShieldAlert } from 'lucide-react';
import { useDateRangeStore } from '@/store/dateRangeStore';
import type { ComparisonMetric } from '../types';
import NetworkComparisonCard from './NetworkComparisonCard';
import ComparisonBarChart from './ComparisonBarChart';
import EfficiencyTable from './EfficiencyTable';
import NetworkRankingStrip from './NetworkRankingStrip';
import { useComparativeAnalysis } from '../hooks/useComparativeAnalysis';
import { Toast } from '@/components/ui/Toast';

const NETWORK_LABELS: Record<string, string> = {
  exoclick: 'ExoClick',
  rollerads: 'RollerAds',
  zeydoo: 'Zeydoo',
  propush: 'Propush',
};

const METRIC_OPTIONS: { value: ComparisonMetric; label: string }[] = [
  { value: 'revenue', label: 'Revenue' },
  { value: 'cost', label: 'Cost' },
  { value: 'roi', label: 'ROI%' },
  { value: 'ctr', label: 'CTR%' },
  { value: 'cpm', label: 'CPM' },
  { value: 'impressions', label: 'Impressions' },
  { value: 'clicks', label: 'Clicks' },
];

interface ComparativeNetworkAnalysisTabProps {
  onNetworkSelect: (networkId: string) => void;
}

export default function ComparativeNetworkAnalysisTab({ onNetworkSelect }: ComparativeNetworkAnalysisTabProps) {
  const router = useRouter();
  const { fromDate, toDate } = useDateRangeStore();
  const {
    selectedMetric: metric,
    setSelectedMetric: setMetric,
    comparisonData: data,
    loadStatus: fetchState,
    errorCode,
    isSyncing: syncingAll,
    sessionExpired,
    dateRangeExceeded,
    fetchComparisonData: fetchData,
    syncAllNetworks: handleSyncAll,
  } = useComparativeAnalysis(fromDate, toDate);

  useEffect(() => {
    if (sessionExpired) router.replace('/');
  }, [sessionExpired, router]);

  return (
    <>
    {sessionExpired && <Toast message="Session expired. Please sign in again." variant="error" />}
    <div className="space-y-5">
      {/* Header row with MetricToggle + Sync All */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          {METRIC_OPTIONS.map(m => (
            <button
              key={m.value}
              onClick={() => setMetric(m.value)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                metric === m.value
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <button
          onClick={handleSyncAll}
          disabled={syncingAll}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
        >
          {syncingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Sync All
        </button>
      </div>

      {/* State rendering */}
      {fetchState === 'error' && errorCode === 403 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">Access Denied — you don&apos;t have permission to view network comparisons.</span>
          <Link href="/dashboard" className="text-xs underline flex-shrink-0">Dashboard</Link>
        </div>
      )}
      {fetchState === 'error' && dateRangeExceeded && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-700 dark:text-amber-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">Date range exceeds 90 days. Please select a shorter range.</span>
        </div>
      )}
      {fetchState === 'error' && errorCode !== 403 && !dateRangeExceeded && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">Something went wrong loading comparison data.</span>
          <button onClick={fetchData} className="text-xs underline hover:no-underline">Retry</button>
        </div>
      )}

      {fetchState === 'empty' && (
        <div className="p-8 text-center space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No data for any network in this date range. Sync your networks to see comparisons.
          </p>
          <button
            onClick={handleSyncAll}
            disabled={syncingAll}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            {syncingAll && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Sync All
          </button>
        </div>
      )}

      {fetchState === 'loading' && (
        <>
          {/* 4 shimmer cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                <div className="h-12 bg-gray-200 dark:bg-gray-700" />
                <div className="bg-white dark:bg-gray-900 p-4 space-y-3">
                  <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded" />
                    <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded" />
                    <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded" />
                    <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded" />
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded" />
                </div>
              </div>
            ))}
          </div>
          {/* shimmer chart */}
          <div className="h-[280px] bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
          {/* shimmer efficiency table */}
          <div className="space-y-2 animate-pulse">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex justify-between px-4 py-2">
                <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            ))}
          </div>
        </>
      )}

      {fetchState === 'success' && data && (
        <>
          {/* Network cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.networks.map(item => (
              <NetworkComparisonCard
                key={item.networkId}
                item={item}
                networkName={NETWORK_LABELS[item.networkId] ?? item.networkId}
                onNetworkClick={onNetworkSelect}
              />
            ))}
          </div>

          {/* Bar chart — horizontally scrollable on mobile */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              {METRIC_OPTIONS.find(m => m.value === metric)?.label} by Network
            </h3>
            <div className="overflow-x-auto">
              <div className="min-w-[400px]">
                <ComparisonBarChart
                  networks={data.networks}
                  metric={metric}
                  networkLabels={NETWORK_LABELS}
                />
              </div>
            </div>
          </div>

          {/* Network ranking strip */}
          {data.rankings.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Network Rankings
              </h3>
              <NetworkRankingStrip rankings={data.rankings} networkLabels={NETWORK_LABELS} />
            </div>
          )}

          {/* Efficiency table (collapsed by default) */}
          <EfficiencyTable metrics={data.crossNetwork} />
        </>
      )}
    </div>
    </>
  );
}
