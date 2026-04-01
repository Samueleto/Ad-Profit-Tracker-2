'use client';

import { useState } from 'react';
import { Loader2, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { getAuth } from 'firebase/auth';

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

type SyncStatus = 'idle' | 'loading' | 'success' | 'error';

interface SyncResult {
  rowsFetched: number;
  dateFrom: string;
  dateTo: string;
  latencyMs: number;
}

export default function ExoClickSyncPanel({ onSyncSuccess }: { onSyncSuccess?: () => void }) {
  const [dateFrom, setDateFrom] = useState(yesterday);
  const [dateTo, setDateTo] = useState(yesterday);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [result, setResult] = useState<SyncResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSync = async () => {
    setStatus('loading');
    setResult(null);
    setErrorMsg(null);
    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/networks/exoclick/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ dateFrom, dateTo }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Sync failed (${res.status})`);
      }
      const data = await res.json();
      setResult({
        rowsFetched: data.rowsFetched ?? 0,
        dateFrom: data.dateFrom ?? dateFrom,
        dateTo: data.dateTo ?? dateTo,
        latencyMs: data.latencyMs ?? 0,
      });
      setStatus('success');
      onSyncSuccess?.();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Sync failed');
      setStatus('error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            disabled={status === 'loading'}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            disabled={status === 'loading'}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white disabled:opacity-50"
          />
        </div>
        <button
          onClick={handleSync}
          disabled={status === 'loading'}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
        >
          {status === 'loading' ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Syncing…</>
          ) : 'Sync Now'}
        </button>
      </div>

      <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
        <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        ExoClick allows up to 10 syncs per hour. Repeated syncs for the same date range may be rate-limited.
      </div>

      <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
        <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        Daily syncs run automatically every night via a scheduled job — you don't need to manually sync yesterday's data each day.
      </div>

      {status === 'success' && result && (
        <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl text-sm">
          <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-green-700 dark:text-green-400">Sync complete</p>
            <ul className="mt-1 text-xs text-green-600 dark:text-green-500 space-y-0.5">
              <li>Rows fetched: <strong>{result.rowsFetched}</strong></li>
              <li>Date range: <strong>{result.dateFrom} → {result.dateTo}</strong></li>
              <li>Latency: <strong>{result.latencyMs}ms</strong></li>
            </ul>
          </div>
        </div>
      )}

      {status === 'error' && errorMsg && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {errorMsg}
        </div>
      )}
    </div>
  );
}
