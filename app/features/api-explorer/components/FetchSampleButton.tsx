'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import type { NetworkId } from '../types';

interface FetchSampleButtonProps {
  networkId: NetworkId;
  onSuccess: (data: Record<string, unknown>) => void;
}

export default function FetchSampleButton({ networkId, onSuccess }: FetchSampleButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSample = async () => {
    setLoading(true);
    setError(null);
    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/networks/config/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ networkId }),
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = await res.json();
      onSuccess(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sample.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-1">
      <button
        onClick={fetchSample}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
      >
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        Fetch Fresh Sample
      </button>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">
          {error}{' '}
          <button onClick={fetchSample} className="underline hover:no-underline">
            Retry
          </button>
        </p>
      )}
    </div>
  );
}
