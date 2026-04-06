'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import { toast } from 'sonner';
import CircuitBreakerStatusPanel from './CircuitBreakerStatusPanel';
import ErrorLogPanel from './ErrorLogPanel';
import RetryStatePanel from './RetryStatePanel';
import ErrorSummaryWidget from './ErrorSummaryWidget';
import RetryConfigPanel from './RetryConfigPanel';

type ErrorTab = 'circuit' | 'logs' | 'retry-state' | 'config';

const TABS: { id: ErrorTab; label: string }[] = [
  { id: 'circuit', label: 'Circuit Breakers' },
  { id: 'logs', label: 'Error Logs' },
  { id: 'retry-state', label: 'Retry State' },
  { id: 'config', label: 'Retry Config' },
];

const BANNER_SESSION_KEY = 'error_monitoring_banner_dismissed';

async function getCircuitStatus(): Promise<{ networksDegraded: number }> {
  const auth = getAuth();
  const doFetch = async (refresh: boolean) => {
    const token = await auth.currentUser?.getIdToken(refresh);
    return fetch('/api/errors/circuit-breaker/status', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  };
  let res = await doFetch(false);
  if (res.status === 401) {
    res = await doFetch(true);
    if (res.status === 401) { toast.error('Session expired. Please sign in again.'); window.location.replace('/'); return { networksDegraded: 0 }; }
  }
  if (!res.ok) return { networksDegraded: 0 };
  const data = await res.json();
  return { networksDegraded: data?.summary?.networksDegraded ?? 0 };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">{title}</h3>
      {children}
    </div>
  );
}

export default function ErrorMonitoringTab() {
  const [activeTab, setActiveTab] = useState<ErrorTab>('circuit');
  // Mounted tabs — lazy: only mount when first activated
  const [mountedTabs, setMountedTabs] = useState<Set<ErrorTab>>(new Set());

  // Cross-panel state
  const [retryRefreshTrigger, setRetryRefreshTrigger] = useState(0);
  const [errorLogNetwork, setErrorLogNetwork] = useState('');

  // Circuit breaker banner
  const [degradedCount, setDegradedCount] = useState(0);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const bannerCheckedRef = useRef(false);

  // Check banner dismiss state and circuit status once on mount
  useEffect(() => {
    if (bannerCheckedRef.current) return;
    bannerCheckedRef.current = true;
    const dismissed = sessionStorage.getItem(BANNER_SESSION_KEY) === '1';
    setBannerDismissed(dismissed);
    getCircuitStatus().then(({ networksDegraded }) => setDegradedCount(networksDegraded));
  }, []);

  const handleDismissBanner = () => {
    sessionStorage.setItem(BANNER_SESSION_KEY, '1');
    setBannerDismissed(true);
  };

  const handleTabChange = (tab: ErrorTab) => {
    setActiveTab(tab);
    setMountedTabs(prev => new Set(prev).add(tab));
  };

  // Pre-mount the initial active tab
  useEffect(() => {
    setMountedTabs(new Set<ErrorTab>(['circuit']));
  }, []);

  // Cross-panel: reset → refresh retry state
  const handleResetSuccess = useCallback(() => {
    setRetryRefreshTrigger(t => t + 1);
    // Re-check banner in case circuits are now all closed
    getCircuitStatus().then(({ networksDegraded }) => setDegradedCount(networksDegraded));
  }, []);

  // Cross-panel: config save → refresh retry state
  const handleConfigSaveSuccess = useCallback(() => {
    setRetryRefreshTrigger(t => t + 1);
  }, []);

  // Cross-panel: network click in summary → filter logs + switch to logs tab
  const handleNetworkClick = useCallback((networkId: string) => {
    setErrorLogNetwork(networkId);
    handleTabChange('logs');
    // Scroll to log panel
    setTimeout(() => {
      document.getElementById('error-log-panel')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  const showBanner = !bannerDismissed && degradedCount > 0;

  return (
    <div className="space-y-4">
      {/* Circuit breaker warning banner */}
      {showBanner && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-500" />
          <span className="flex-1">
            {degradedCount} network{degradedCount > 1 ? 's' : ''} {degradedCount > 1 ? 'have' : 'has'} open circuit breakers — sync is paused.{' '}
            <button
              onClick={() => handleTabChange('circuit')}
              className="underline font-medium hover:text-amber-900 dark:hover:text-amber-200"
            >
              View details
            </button>
          </span>
          <button onClick={handleDismissBanner} className="text-amber-500 hover:text-amber-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary widget — always visible, loads independently */}
      <Section title="Error Summary">
        <ErrorSummaryWidget onNetworkClick={handleNetworkClick} />
      </Section>

      {/* Detail tabs — lazy-mount on first activation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => handleTabChange(tab.id)}
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

      {/* Lazy-mounted panels */}
      <div style={{ display: activeTab === 'circuit' ? undefined : 'none' }}>
        {mountedTabs.has('circuit') && (
          <Section title="Circuit Breaker Status">
            <CircuitBreakerStatusPanel onResetSuccess={handleResetSuccess} />
          </Section>
        )}
      </div>

      <div id="error-log-panel" style={{ display: activeTab === 'logs' ? undefined : 'none' }}>
        {mountedTabs.has('logs') && (
          <Section title="Error Logs">
            <ErrorLogPanel initialNetwork={errorLogNetwork} />
          </Section>
        )}
      </div>

      <div style={{ display: activeTab === 'retry-state' ? undefined : 'none' }}>
        {mountedTabs.has('retry-state') && (
          <Section title="Retry State">
            <RetryStatePanel refreshTrigger={retryRefreshTrigger} />
          </Section>
        )}
      </div>

      <div style={{ display: activeTab === 'config' ? undefined : 'none' }}>
        {mountedTabs.has('config') && (
          <Section title="Retry Configuration">
            <RetryConfigPanel onSaveSuccess={handleConfigSaveSuccess} />
          </Section>
        )}
      </div>
    </div>
  );
}
