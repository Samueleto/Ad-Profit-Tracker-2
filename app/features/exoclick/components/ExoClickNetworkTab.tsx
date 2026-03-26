'use client';

import { useState } from 'react';
import ExoClickLatestSummary from './ExoClickLatestSummary';
import ExoClickStatsView from './ExoClickStatsView';
import ExoClickCountryBreakdownView from './ExoClickCountryBreakdownView';
import ExoClickSyncPanel from './ExoClickSyncPanel';
import ExoClickApiExplorer from './ExoClickApiExplorer';

type ExoTab = 'summary' | 'stats' | 'countries' | 'sync' | 'explorer';

const TABS: { id: ExoTab; label: string }[] = [
  { id: 'summary', label: 'Overview' },
  { id: 'stats', label: 'Stats' },
  { id: 'countries', label: 'Countries' },
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

export default function ExoClickNetworkTab() {
  const [activeTab, setActiveTab] = useState<ExoTab>('summary');

  return (
    <div className="space-y-4">
      {/* Sub-tab bar */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
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

      {activeTab === 'summary' && (
        <Section title="ExoClick — Latest Stats">
          <ExoClickLatestSummary />
        </Section>
      )}
      {activeTab === 'stats' && (
        <Section title="ExoClick — Historical Stats">
          <ExoClickStatsView />
        </Section>
      )}
      {activeTab === 'countries' && (
        <Section title="ExoClick — Country Breakdown">
          <ExoClickCountryBreakdownView />
        </Section>
      )}
      {activeTab === 'sync' && (
        <Section title="ExoClick — Manual Sync">
          <ExoClickSyncPanel />
        </Section>
      )}
      {activeTab === 'explorer' && (
        <Section title="ExoClick — API Explorer">
          <ExoClickApiExplorer />
        </Section>
      )}
    </div>
  );
}
