'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { AlertTriangle, X } from 'lucide-react';
import { Toast } from '@/components/ui/Toast';
import ReconciliationOverviewPanel from './ReconciliationOverviewPanel';
import AnomalyListView from './AnomalyListView';
import ValidationRulesEditor from './ValidationRulesEditor';

type ReconTab = 'overview' | 'anomalies' | 'rules';

const VALID_TABS: ReconTab[] = ['overview', 'anomalies', 'rules'];

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
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const tabParam = searchParams.get('tab') as ReconTab | null;
  const activeTab: ReconTab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'overview';
  const networkIdFromUrl = searchParams.get('networkId') ?? '';

  // Lazy-mount: only mount tabs when first activated
  const [mountedTabs, setMountedTabs] = useState<Set<ReconTab>>(new Set([activeTab]));

  // Anomalies-found prompt after a reconciliation run
  const [anomaliesPrompt, setAnomaliesPrompt] = useState<{ count: number; networkId: string } | null>(null);

  // Resolved toast network name
  const [resolvedToastNetwork, setResolvedToastNetwork] = useState<string | null>(null);

  // Mount initial tab from URL (e.g. deep-link on page load)
  useEffect(() => {
    setMountedTabs(prev => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  const handleTabChange = useCallback((tab: ReconTab, extra?: Record<string, string>) => {
    setMountedTabs(prev => {
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
    const params = new URLSearchParams();
    params.set('tab', tab);
    if (extra) {
      Object.entries(extra).forEach(([k, v]) => { if (v) params.set(k, v); });
    }
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname]);

  const handleAnomaliesFound = useCallback((count: number, networkId: string) => {
    setAnomaliesPrompt({ count, networkId });
  }, []);

  const handleViewAnomalies = () => {
    const netId = anomaliesPrompt?.networkId ?? '';
    handleTabChange('anomalies', netId ? { networkId: netId } : {});
    setAnomaliesPrompt(null);
  };

  const handleAllResolved = useCallback((networkId: string) => {
    setResolvedToastNetwork(networkId);
  }, []);

  return (
    <div className="space-y-4">
      {/* Anomalies-found prompt */}
      {anomaliesPrompt && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-500" />
          <span className="flex-1">
            {anomaliesPrompt.count} {anomaliesPrompt.count === 1 ? 'anomaly' : 'anomalies'} detected —{' '}
            <button
              onClick={handleViewAnomalies}
              className="underline font-medium hover:text-amber-900 dark:hover:text-amber-200"
            >
              view {anomaliesPrompt.count === 1 ? 'it' : 'them'} now
            </button>
          </span>
          <button onClick={() => setAnomaliesPrompt(null)} className="text-amber-500 hover:text-amber-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tab bar */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-1 -mb-px">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => handleTabChange(tab.id)}
              className={`px-4 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >{tab.label}</button>
          ))}
        </nav>
      </div>

      {/* Lazy-mounted panels — hidden via display:none to preserve state */}
      <div style={{ display: activeTab === 'overview' ? undefined : 'none' }}>
        {mountedTabs.has('overview') && (
          <Section title="Reconciliation Status">
            <ReconciliationOverviewPanel onAnomaliesFound={handleAnomaliesFound} />
          </Section>
        )}
      </div>

      <div style={{ display: activeTab === 'anomalies' ? undefined : 'none' }}>
        {mountedTabs.has('anomalies') && (
          <Section title="Anomalies">
            <AnomalyListView
              initialNetwork={networkIdFromUrl}
              onAllResolved={handleAllResolved}
            />
          </Section>
        )}
      </div>

      <div style={{ display: activeTab === 'rules' ? undefined : 'none' }}>
        {mountedTabs.has('rules') && (
          <Section title="Validation Rules">
            <ValidationRulesEditor />
          </Section>
        )}
      </div>

      {/* Resolved toast */}
      {resolvedToastNetwork && (
        <Toast
          message={`All anomalies resolved for ${resolvedToastNetwork}!`}
          variant="success"
          onClose={() => setResolvedToastNetwork(null)}
        />
      )}
    </div>
  );
}
