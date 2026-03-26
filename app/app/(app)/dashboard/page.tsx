'use client';

import { useState } from 'react';
import ManualRefreshPanel from '@/features/manual-refresh/components/ManualRefreshPanel';
import SyncStatusPanel from '@/features/sync-status/components/SyncStatusPanel';
import GeoBreakdownSection from '@/features/geo-breakdown/components/GeoBreakdownSection';
import ComparativeNetworkAnalysisTab from '@/features/comparative-analysis/components/ComparativeNetworkAnalysisTab';
import DateRangeToolbar from '@/features/date-range/components/DateRangeToolbar';

type DashboardTab = 'overview' | 'compare' | 'exoclick' | 'rollerads' | 'zeydoo' | 'propush';

const TABS: { id: DashboardTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'compare', label: 'Compare' },
  { id: 'exoclick', label: 'ExoClick' },
  { id: 'rollerads', label: 'RollerAds' },
  { id: 'zeydoo', label: 'Zeydoo' },
  { id: 'propush', label: 'Propush' },
];

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Financial Metrics Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          View your ad network profits, trends, and analytics.
        </p>
      </div>

      {/* Date range toolbar — sticky */}
      <DateRangeToolbar />

      {/* Tab bar */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <ManualRefreshPanel />
            </div>
            <div className="lg:col-span-2">
              <SyncStatusPanel />
            </div>
          </div>
          <GeoBreakdownSection />
        </div>
      )}

      {activeTab === 'compare' && (
        <ComparativeNetworkAnalysisTab
          onNetworkSelect={(networkId) => setActiveTab(networkId as DashboardTab)}
        />
      )}

      {activeTab === 'exoclick' && (
        <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
          ExoClick network details coming soon.
        </div>
      )}

      {activeTab === 'rollerads' && (
        <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
          RollerAds network details coming soon.
        </div>
      )}

      {activeTab === 'zeydoo' && (
        <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
          Zeydoo network details coming soon.
        </div>
      )}

      {activeTab === 'propush' && (
        <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
          Propush network details coming soon.
        </div>
      )}
    </div>
  );
}
