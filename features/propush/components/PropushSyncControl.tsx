'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { getAuth } from 'firebase/auth';

function mapSyncError(status: number, body: Record<string, unknown>): string {
  switch (status) {
    case 400:
      if (String(body.error ?? '').includes('network') || String(body.message ?? '').includes('disabled')) {
        return 'Propush is currently disabled. Enable it in your network settings.';
      }
      return 'Please check your date range — dates must be valid and within 90 days.';
    case 401:
      return '__session_expired__';
    case 404:
      return 'No Propush API key found. Add your API key in the network settings first.';
    case 429:
      return "You've hit the sync limit (10/hour). Please wait before syncing again.";
    case 502:
      return "Propush's API is currently unavailable. Try again in a few minutes.";
    default:
      return 'Something went wrong on our end. Please try again.';
  }
}

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

interface PropushSyncControlProps {
  onSyncComplete?: () => void;
}

export default function PropushSyncControl({ onSyncComplete }: PropushSyncControlProps) {
  const router = useRouter();
  const [dateFrom, setDateFrom] = useState(yesterday);
  const [dateTo, setDateTo] = useState(yesterday);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const doRequest = async (token: string | undefined) =>
    fetch('/api/networks/propush/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ dateFrom, dateTo }),
    });

  const handleSync = async () => {
    setStatus('loading');
    setResultMsg(null);
    setErrorMsg(null);
    try {
      const auth = getAuth();
      let token = await auth.currentUser?.getIdToken();
      let res = await doRequest(token);

      // 401 — try token refresh once
      if (res.status === 401) {
        token = await auth.currentUser?.getIdToken(true).catch(() => undefined);
        res = await doRequest(token);
        if (res.status === 401) {
          router.replace('/');
          return;
        }
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = mapSyncError(res.status, body);
        setErrorMsg(msg);
        setStatus('error');
        return;
      }

      const data = await res.json();
      setStatus('success');
      setResultMsg(`Sync complete — ${data.rowsFetched ?? 0} rows fetched in ${data.latencyMs ?? 0}ms`);
      onSyncComplete?.();
    } catch {
      setStatus('error');
      setErrorMsg('Something went wrong on our end. Please try again.');
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
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors">
          {status === 'loading' ? <><Loader2 className="w-4 h-4 animate-spin" /> Syncing…</> : 'Sync Now'}
        </button>
      </div>

      <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
        <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        Propush allows up to 10 syncs per hour. Repeated syncs for the same date range may be rate-limited.
      </div>

      <div className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
        <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        Daily syncs run automatically every night via a scheduled job — you don't need to manually sync yesterday's data each day.
      </div>

      {status === 'success' && resultMsg && (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <CheckCircle className="w-4 h-4" /> {resultMsg}
        </div>
      )}

      {status === 'error' && errorMsg && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {errorMsg}
        </div>
      )}
    </div>
  );
}
