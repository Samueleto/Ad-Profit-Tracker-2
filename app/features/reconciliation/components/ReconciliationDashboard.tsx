'use client';

import { useState } from 'react';
import ReconciliationOverviewPanel from './ReconciliationOverviewPanel';
import AnomalyListView from './AnomalyListView';
import ValidationRulesEditor from './ValidationRulesEditor';

type ReconTab = 'overview' | 'anomalies' | 'rules';

const TABS: { id: ReconTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'anomalies', label: 'Anomalies' },
  { id: 'rules', label: 'Validation Rules' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">{title}</h3>
      {children}
    </div>
  );
}

export default function ReconciliationDashboard() {
  const [activeTab, setActiveTab] = useState<ReconTab>('overview');

  return (
    <div className="space-y-4">
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-1 -mb-px">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >{tab.label}</button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && (
        <Section title="Reconciliation Status">
          <ReconciliationOverviewPanel />
        </Section>
      )}
      {activeTab === 'anomalies' && (
        <Section title="Anomalies">
          <AnomalyListView />
        </Section>
      )}
      {activeTab === 'rules' && (
        <Section title="Validation Rules">
          <ValidationRulesEditor />
        </Section>
      )}
    </div>
  );
}
