'use client';

import { useState, useCallback } from 'react';
import ZeydooLatestCard from './ZeydooLatestCard';
import ZeydooStatsOverview from './ZeydooStatsOverview';
import ZeydooTopCountries from './ZeydooTopCountries';
import ZeydooSyncControl from './ZeydooSyncControl';
import ZeydooRawExplorer from './ZeydooRawExplorer';

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 6);
  return { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] };
}

type ZeydooTab = 'overview' | 'sync' | 'explorer';

const TABS: { id: ZeydooTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'sync', label: 'Sync' },
  { id: 'explorer', label: 'API Explorer' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">{title}</h3>
      {children}
    </div>
  );
}

export default function ZeydooNetworkTab() {
  const [activeTab, setActiveTab] = useState<ZeydooTab>('overview');
  const init = defaultRange();
  const [dateFrom, setDateFrom] = useState(init.from);
  const [dateTo, setDateTo] = useState(init.to);

  const handleDateChange = useCallback((from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
  }, []);

  return (
    <div className="space-y-4">
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-green-500 text-green-600 dark:text-green-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-4">
          <Section title="Zeydoo — Latest Stats">
            <ZeydooLatestCard onSync={() => setActiveTab('sync')} />
          </Section>
          <Section title="Zeydoo — Historical Stats">
            <ZeydooStatsOverview dateFrom={dateFrom} dateTo={dateTo} onDateChange={handleDateChange} />
          </Section>
          <Section title="Top Countries">
            <ZeydooTopCountries dateFrom={dateFrom} dateTo={dateTo} />
          </Section>
        </div>
      )}

      {activeTab === 'sync' && (
        <Section title="Zeydoo — Manual Sync">
          <ZeydooSyncControl onSyncComplete={() => setActiveTab('overview')} />
        </Section>
      )}

      {activeTab === 'explorer' && (
        <Section title="Zeydoo — API Explorer">
          <ZeydooRawExplorer onGoToSync={() => setActiveTab('sync')} />
        </Section>
      )}
    </div>
  );
}
