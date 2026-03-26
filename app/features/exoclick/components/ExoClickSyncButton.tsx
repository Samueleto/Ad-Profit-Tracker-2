'use client';

import { useState } from 'react';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { getAuth } from 'firebase/auth';

interface ExoClickSyncButtonProps {
  dateFrom: string;
  dateTo: string;
  onSyncComplete?: () => void;
}

export default function ExoClickSyncButton({ dateFrom, dateTo, onSyncComplete }: ExoClickSyncButtonProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const handleSync = async () => {
    setStatus('loading');
    setMessage(null);
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
        throw new Error(body.error ?? `Sync failed: ${res.status}`);
      }

      const data = await res.json();
      setStatus('success');
      setMessage(`Sync complete — ${data.rowsFetched ?? 0} rows fetched`);
      onSyncComplete?.();
      setTimeout(() => setStatus('idle'), 4000);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Sync failed');
    }
  };

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        onClick={handleSync}
        disabled={status === 'loading'}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
      >
        {status === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
        {status === 'loading' ? 'Syncing…' : 'Sync ExoClick'}
      </button>
      {status === 'success' && message && (
        <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
          <CheckCircle className="w-3.5 h-3.5" />
          {message}
        </div>
      )}
      {status === 'error' && message && (
        <div className="flex items-center gap-1.5 text-xs text-red-500">
          <AlertCircle className="w-3.5 h-3.5" />
          {message}
        </div>
      )}
    </div>
  );
}
