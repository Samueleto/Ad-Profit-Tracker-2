'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import { AlertCircle, CheckCircle, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';

const NETWORKS = ['exoclick', 'rollerads', 'zeydoo', 'propush'] as const;
type Network = typeof NETWORKS[number];

interface NetworkStatus {
  networkId: Network;
  lastValidationStatus: string;
  lastValidationAt: string | null;
  anomalyCount: number;
}

interface StatusResponse {
  overallHealth: 'healthy' | 'degraded' | 'critical';
  networks: NetworkStatus[];
}

interface RunResult {
  recordsChecked?: number;
  documentsChecked?: number;
  anomaliesFound: number;
  durationMs?: number;
}

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken();
  return fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

const HEALTH_STYLES = {
  healthy: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', icon: CheckCircle },
  degraded: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', icon: AlertTriangle },
  critical: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', icon: AlertCircle },
};

export default function ReconciliationOverviewPanel({ onAnomaliesFound }: { onAnomaliesFound?: (count: number, networkId: string) => void }) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dateFrom, setDateFrom] = useState(yesterday);
  const [dateTo, setDateTo] = useState(yesterday);
  const [running, setRunning] = useState<Network | 'all' | null>(null);
  const [runResults, setRunResults] = useState<Record<string, RunResult>>({});
  const [runErrors, setRunErrors] = useState<Record<string, string>>({});

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await authFetch('/api/reconciliation/status');
      if (!res.ok) { setError(true); return; }
      setStatus(await res.json());
    } catch { setError(true); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleRun = async (networkId: Network | 'all') => {
    const diffDays = Math.round((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000);
    if (diffDays > 90) { alert('Date range cannot exceed 90 days.'); return; }
    setRunning(networkId);
    setRunErrors(prev => ({ ...prev, [networkId]: '' }));
    try {
      const body: Record<string, string> = { dateFrom, dateTo };
      if (networkId !== 'all') body.networkId = networkId;
      const res = await authFetch('/api/reconciliation/run', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setRunErrors(prev => ({ ...prev, [networkId]: data.error ?? 'Run failed.' }));
        return;
      }
      const data = await res.json();
      setRunResults(prev => ({ ...prev, [networkId]: data }));
      fetchStatus();
      if (data.anomaliesFound > 0) {
        onAnomaliesFound?.(data.anomaliesFound, networkId === 'all' ? '' : networkId);
      }
    } finally { setRunning(null); }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-xl w-48" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 dark:bg-gray-800 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-500">
        <AlertCircle className="w-4 h-4" /> Failed to load reconciliation status.
        <button onClick={fetchStatus} className="underline text-xs">Retry</button>
      </div>
    );
  }

  const health = status?.overallHealth ?? 'healthy';
  const HealthStyle = HEALTH_STYLES[health];
  const HealthIcon = HealthStyle.icon;

  return (
    <div className="space-y-5">
      {/* Health badge */}
      <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl ${HealthStyle.bg}`}>
        <HealthIcon className={`w-4 h-4 ${HealthStyle.text}`} />
        <span className={`text-sm font-semibold capitalize ${HealthStyle.text}`}>{health}</span>
      </div>

      {/* Date range + Run All */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white" />
        </div>
        <button onClick={() => handleRun('all')} disabled={running !== null}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors">
          {running === 'all' ? <><Loader2 className="w-4 h-4 animate-spin" /> Running…</> : 'Run All'}
        </button>
        <button onClick={fetchStatus} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {runResults['all'] && (
        <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-lg">
          Run All: {runResults['all'].documentsChecked ?? runResults['all'].recordsChecked ?? 0} docs checked,{' '}
          {runResults['all'].anomaliesFound} anomalies found
          {runResults['all'].durationMs != null && ` (${runResults['all'].durationMs}ms)`}
        </div>
      )}

      {/* Network cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(status?.networks ?? NETWORKS.map(id => ({ networkId: id, lastValidationStatus: 'never_run', lastValidationAt: null, anomalyCount: 0 }))).map(net => (
          <div key={net.networkId} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">{net.networkId}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                net.lastValidationStatus === 'clean' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : net.lastValidationStatus === 'anomalies_detected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
              }`}>{net.lastValidationStatus.replace(/_/g, ' ')}</span>
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
              {net.lastValidationAt && <p>Last run: {new Date(net.lastValidationAt).toLocaleString()}</p>}
              <p>Anomalies: <strong className="text-gray-900 dark:text-white">{net.anomalyCount}</strong></p>
            </div>

            {runResults[net.networkId] && (
              <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-2 py-1.5 rounded">
                {runResults[net.networkId].documentsChecked ?? runResults[net.networkId].recordsChecked ?? 0} docs,{' '}
                {runResults[net.networkId].anomaliesFound} anomalies
                {runResults[net.networkId].durationMs != null && ` (${runResults[net.networkId].durationMs}ms)`}
              </div>
            )}

            {runErrors[net.networkId] && (
              <p className="text-xs text-red-500">{runErrors[net.networkId]}</p>
            )}

            <button
              onClick={() => handleRun(net.networkId as Network)}
              disabled={running !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50 transition-colors"
            >
              {running === net.networkId ? <><Loader2 className="w-3 h-3 animate-spin" /> Running…</> : 'Run Reconciliation'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
