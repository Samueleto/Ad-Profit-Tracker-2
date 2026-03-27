'use client';

import { useState, useCallback } from 'react';
import { Info } from 'lucide-react';
import RollerAdsLatestSummary from './RollerAdsLatestSummary';
import RollerAdsStatsView from './RollerAdsStatsView';
import RollerAdsCountryBreakdownView from './RollerAdsCountryBreakdownView';
import RollerAdsSyncPanel from './RollerAdsSyncPanel';
import RollerAdsApiExplorer from './RollerAdsApiExplorer';
import { useRollerAdsLatest } from '../hooks/useRollerAdsStats';

type RollerAdsTab = 'summary' | 'stats' | 'countries' | 'sync' | 'explorer';

const TABS: { id: RollerAdsTab; label: string }[] = [
  { id: 'summary', label: 'Overview' },
  { id: 'stats', label: 'Stats' },
  { id: 'countries', label: 'Countries' },
  { id: 'sync', label: 'Sync' },
  { id: 'explorer', label: 'API Explorer' },
];

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 6);
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">{title}</h3>
      {children}
    </div>
  );
}

export default function RollerAdsNetworkTab() {
  const [activeTab, setActiveTab] = useState<RollerAdsTab>('summary');
  const init = defaultRange();
  const [sharedDateFrom, setSharedDateFrom] = useState(init.from);
  const [sharedDateTo, setSharedDateTo] = useState(init.to);
  const [dataUpdatedBanner, setDataUpdatedBanner] = useState(false);

  const { refetch: refetchLatest } = useRollerAdsLatest();

  const handleSyncSuccess = useCallback(() => {
    refetchLatest();
    if (activeTab === 'stats' || activeTab === 'countries') {
      setDataUpdatedBanner(true);
    }
  }, [activeTab, refetchLatest]);

  const handleTabChange = (tab: RollerAdsTab) => {
    setActiveTab(tab);
    setDataUpdatedBanner(false);
  };

  return (
    <div className="space-y-4">
      {/* Sub-tab bar */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-4 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
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

      {dataUpdatedBanner && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-xs text-blue-700 dark:text-blue-400 rounded-lg">
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          Data updated — the view now reflects the latest sync.
          <button onClick={() => setDataUpdatedBanner(false)} className="ml-auto text-blue-500 hover:text-blue-700 dark:hover:text-blue-300">✕</button>
        </div>
      )}

      {activeTab === 'summary' && (
        <Section title="RollerAds — Latest Stats">
          <RollerAdsLatestSummary onGoToSync={() => handleTabChange('sync')} />
        </Section>
      )}
      {activeTab === 'stats' && (
        <Section title="RollerAds — Historical Stats">
          <RollerAdsStatsView
            dateFrom={sharedDateFrom}
            dateTo={sharedDateTo}
            onDateFromChange={setSharedDateFrom}
            onDateToChange={setSharedDateTo}
          />
        </Section>
      )}
      {activeTab === 'countries' && (
        <Section title="RollerAds — Country Breakdown">
          <RollerAdsCountryBreakdownView
            dateFrom={sharedDateFrom}
            dateTo={sharedDateTo}
            onDateFromChange={setSharedDateFrom}
            onDateToChange={setSharedDateTo}
          />
        </Section>
      )}
      {activeTab === 'sync' && (
        <Section title="RollerAds — Manual Sync">
          <RollerAdsSyncPanel onSyncSuccess={handleSyncSuccess} />
        </Section>
      )}
      {activeTab === 'explorer' && (
        <Section title="RollerAds — API Explorer">
          <RollerAdsApiExplorer />
        </Section>
      )}
    </div>
  );
}
