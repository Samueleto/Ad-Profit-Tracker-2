'use client';

import { useState } from 'react';
import CircuitBreakerStatusPanel from './CircuitBreakerStatusPanel';
import ErrorLogPanel from './ErrorLogPanel';
import RetryStatePanel from './RetryStatePanel';
import ErrorSummaryWidget from './ErrorSummaryWidget';
import RetryConfigPanel from './RetryConfigPanel';

type ErrorTab = 'summary' | 'circuit' | 'logs' | 'retry-state' | 'config';

const TABS: { id: ErrorTab; label: string }[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'circuit', label: 'Circuit Breakers' },
  { id: 'logs', label: 'Error Logs' },
  { id: 'retry-state', label: 'Retry State' },
  { id: 'config', label: 'Retry Config' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">{title}</h3>
      {children}
    </div>
  );
}

export default function ErrorMonitoringTab() {
  const [activeTab, setActiveTab] = useState<ErrorTab>('summary');

  return (
    <div className="space-y-4">
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-red-500 text-red-600 dark:text-red-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'summary' && (
        <Section title="Error Summary">
          <ErrorSummaryWidget />
        </Section>
      )}
      {activeTab === 'circuit' && (
        <Section title="Circuit Breaker Status">
          <CircuitBreakerStatusPanel />
        </Section>
      )}
      {activeTab === 'logs' && (
        <Section title="Error Logs">
          <ErrorLogPanel />
        </Section>
      )}
      {activeTab === 'retry-state' && (
        <Section title="Retry State">
          <RetryStatePanel />
        </Section>
      )}
      {activeTab === 'config' && (
        <Section title="Retry Configuration">
          <RetryConfigPanel />
        </Section>
      )}
    </div>
  );
}
