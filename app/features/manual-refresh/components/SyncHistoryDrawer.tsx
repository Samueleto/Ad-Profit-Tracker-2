'use client';

import { useEffect, useState } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import SyncStatusBadge, { type SyncStatus } from './SyncStatusBadge';

interface SyncEvent {
  id: string;
  networkId: string;
  status: SyncStatus;
  rowsFetched: number | null;
  latencyMs: number | null;
  createdAt: string;
}

interface SyncHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatLatency(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const NETWORK_LABELS: Record<string, string> = {
  exoclick: 'ExoClick',
  rollerads: 'RollerAds',
  zeydoo: 'Zeydoo',
  propush: 'Propush',
};

export default function SyncHistoryDrawer({ isOpen, onClose }: SyncHistoryDrawerProps) {
  const [events, setEvents] = useState<SyncEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const load = async (retry = false) => {
      setLoading(true);
      setError(null);
      try {
        const auth = getAuth();
        const token = await auth.currentUser?.getIdToken(retry);
        const res = await fetch('/api/sync/history', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!cancelled) {
          if (res.status === 401 && !retry) { load(true); return; }
          if (!res.ok) { setError(`Failed to load history (${res.status})`); return; }
          const data = await res.json();
          setEvents(data.events ?? []);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full z-50 w-full max-w-sm bg-white dark:bg-gray-900 shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Sync History</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading…
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-500">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
          {!loading && !error && events.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">No sync history yet.</p>
          )}
          {events.map(e => (
            <div key={e.id} className="flex items-start gap-3 py-2.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {NETWORK_LABELS[e.networkId] ?? e.networkId}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {e.rowsFetched != null ? `${e.rowsFetched} rows` : '—'} · {formatLatency(e.latencyMs)}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{new Date(e.createdAt).toLocaleString()}</p>
              </div>
              <SyncStatusBadge status={e.status} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
