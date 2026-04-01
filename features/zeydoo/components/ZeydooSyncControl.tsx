'use client';

import { useState } from 'react';
import { Loader2, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { getAuth } from 'firebase/auth';

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

interface ZeydooSyncControlProps {
  onSyncComplete?: () => void;
}

export default function ZeydooSyncControl({ onSyncComplete }: ZeydooSyncControlProps) {
  const [dateFrom, setDateFrom] = useState(yesterday);
  const [dateTo, setDateTo] = useState(yesterday);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSync = async () => {
    setStatus('loading');
    setResultMsg(null);
    setErrorMsg(null);
    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/networks/zeydoo/sync', {
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
      setStatus('success');
      setResultMsg(`Sync complete — ${data.rowsFetched ?? 0} rows fetched in ${data.latencyMs ?? 0}ms`);
      onSyncComplete?.();
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Sync failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            disabled={status === 'loading'}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white disabled:opacity-50" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            disabled={status === 'loading'}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white disabled:opacity-50" />
        </div>
        <button onClick={handleSync} disabled={status === 'loading'}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 transition-colors">
          {status === 'loading' ? <><Loader2 className="w-4 h-4 animate-spin" /> Syncing…</> : 'Sync Now'}
        </button>
      </div>

      <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
        <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        Syncing pulls Zeydoo revenue data for the selected date range.
      </div>

      {status === 'success' && resultMsg && (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <CheckCircle className="w-4 h-4" /> {resultMsg}
        </div>
      )}

      {status === 'error' && errorMsg && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4" /> {errorMsg}
        </div>
      )}
    </div>
  );
}
