'use client';

import { useState, useRef } from 'react';
import { format, subDays } from 'date-fns';
import ManualRefreshPanel from '@/features/manual-refresh/components/ManualRefreshPanel';
import SyncStatusPanel from '@/features/sync-status/components/SyncStatusPanel';
import GeoBreakdownSection from '@/features/geo-breakdown/components/GeoBreakdownSection';
import ComparativeNetworkAnalysisTab from '@/features/comparative-analysis/components/ComparativeNetworkAnalysisTab';
import DateRangeToolbar from '@/features/date-range/components/DateRangeToolbar';
import ExportModal from '@/features/excel-export/components/ExportModal';
import { useDashboardStore } from '@/store/dashboardStore';
import { Download, ChevronDown } from 'lucide-react';
import ExoClickNetworkTab from '@/features/exoclick/components/ExoClickNetworkTab';
import ZeydooNetworkTab from '@/features/zeydoo/components/ZeydooNetworkTab';
import FinancialMetricsSection from '@/features/dashboard/components/FinancialMetricsSection';
import PerNetworkAnalyticsTabsSection from '@/features/network-analytics/components/PerNetworkAnalyticsTabsSection';
import PerformanceBenchmarkingTab from '@/features/benchmarking/components/PerformanceBenchmarkingTab';
import FilterToolbar from '@/features/data-filtering/components/FilterToolbar';
import ApiExplorerTab from '@/features/api-explorer/components/ApiExplorerTab';

type DashboardTab = 'overview' | 'compare' | 'benchmarks' | 'exoclick' | 'rollerads' | 'zeydoo' | 'propush' | 'api-explorer';

const TABS: { id: DashboardTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'compare', label: 'Compare' },
  { id: 'benchmarks', label: 'Benchmarks' },
  { id: 'exoclick', label: 'ExoClick' },
  { id: 'rollerads', label: 'RollerAds' },
  { id: 'zeydoo', label: 'Zeydoo' },
  { id: 'propush', label: 'Propush' },
  { id: 'api-explorer', label: 'API Explorer' },
];

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  // Track which tabs have ever been activated — for lazy-mount (mount once, keep in DOM)
  const [activatedTabs, setActivatedTabs] = useState<Set<DashboardTab>>(new Set(['overview']));
  const { exportModalOpen, setExportModalOpen } = useDashboardStore();
  const [syncPanelOpen, setSyncPanelOpen] = useState(false);
  const syncRef = useRef<HTMLDivElement>(null);
  const today = new Date();
  const defaultDateFrom = format(subDays(today, 29), 'yyyy-MM-dd');
  const defaultDateTo = format(today, 'yyyy-MM-dd');

  const handleTabChange = (tab: DashboardTab) => {
    setActiveTab(tab);
    setActivatedTabs(prev => { const s = new Set(prev); s.add(tab); return s; });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            Financial Metrics Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            View your ad network profits, trends, and analytics.
          </p>
        </div>
        <button
          onClick={() => setExportModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Date range toolbar — sticky */}
      <DateRangeToolbar />

      {/* Filter toolbar — sticky, below date range */}
      <FilterToolbar dateFrom={defaultDateFrom} dateTo={defaultDateTo} />

      {/* Tab bar */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab panels */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <FinancialMetricsSection
            onExport={() => setExportModalOpen(true)}
            onSyncNow={() => {
              setSyncPanelOpen(true);
              setTimeout(() => syncRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
            }}
          />

          <div id="daily-trend">
            <PerNetworkAnalyticsTabsSection dateFrom={defaultDateFrom} dateTo={defaultDateTo} />
          </div>

          {/* Geo breakdown — below daily trend */}
          <GeoBreakdownSection />

          {/* Sync Status Panel — live polling, circuit breaker, anomalies */}
          <SyncStatusPanel />

          {/* Collapsible ManualRefreshPanel */}
          <div id="sync" ref={syncRef} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <button
              onClick={() => setSyncPanelOpen(p => !p)}
              className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Manual Sync Controls
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${syncPanelOpen ? 'rotate-180' : ''}`} />
            </button>
            {syncPanelOpen && (
              <div className="border-t border-gray-100 dark:border-gray-800 p-4">
                <ManualRefreshPanel />
              </div>
            )}
          </div>

          {/* Reconciliation anchor — target for CriticalAnomaliesStrip 'View Details' link */}
          <div id="reconciliation" />
        </div>
      )}

      {/* Compare — lazy-mount: renders only after first activation, stays mounted (hidden) after */}
      {activatedTabs.has('compare') && (
        <div className={activeTab !== 'compare' ? 'hidden' : ''}>
          <ComparativeNetworkAnalysisTab
            onNetworkSelect={(networkId) => handleTabChange(networkId as DashboardTab)}
          />
        </div>
      )}

      {activeTab === 'benchmarks' && (
        <PerformanceBenchmarkingTab dateFrom={defaultDateFrom} dateTo={defaultDateTo} />
      )}

      {activeTab === 'exoclick' && <ExoClickNetworkTab />}

      {activeTab === 'rollerads' && (
        <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
          RollerAds network details coming soon.
        </div>
      )}

      {activeTab === 'zeydoo' && <ZeydooNetworkTab />}

      {activeTab === 'propush' && (
        <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
          Propush network details coming soon.
        </div>
      )}

      {activeTab === 'api-explorer' && <ApiExplorerTab />}

      {/* Export Modal */}
      {exportModalOpen && <ExportModal onClose={() => setExportModalOpen(false)} />}
    </div>
  );
}
