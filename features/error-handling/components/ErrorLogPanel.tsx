'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth } from 'firebase/auth';
import { AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const NETWORKS = ['exoclick', 'rollerads', 'zeydoo', 'propush'];

interface ErrorLog {
  id: string;
  createdAt: string;
  networkId: string;
  errorMessage: string;
  errorCategory: string;
  attemptNumber: number;
  backoffDelay: number;
}

async function authFetch(path: string, refresh = false): Promise<Response> {
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken(refresh);
  return fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export default function ErrorLogPanel({ initialNetwork = '' }: { initialNetwork?: string }) {
  const router = useRouter();
  const [network, setNetwork] = useState(initialNetwork);
  const [errorCode, setErrorCode] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const buildQuery = (cur?: string | null) => {
    const p = new URLSearchParams();
    if (network) p.set('networkId', network);
    if (errorCode) p.set('errorCode', errorCode);
    if (startDate) p.set('startDate', startDate);
    if (endDate) p.set('endDate', endDate);
    if (cur) p.set('cursor', cur);
    return p.toString();
  };

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      let res = await authFetch(`/api/errors/log?${buildQuery()}`);
      if (res.status === 401) {
        res = await authFetch(`/api/errors/log?${buildQuery()}`, true);
        if (res.status === 401) {
          toast.error('Session expired. Please sign in again.');
          router.replace('/');
          return;
        }
      }
      if (!res.ok) { setError(true); return; }
      const data = await res.json();
      setLogs(data.logs ?? []);
      setCursor(data.nextCursor ?? null);
      setHasMore(data.hasMore ?? false);
    } catch { setError(true); }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network, errorCode, startDate, endDate, router]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      let res = await authFetch(`/api/errors/log?${buildQuery(cursor)}`);
      if (res.status === 401) {
        res = await authFetch(`/api/errors/log?${buildQuery(cursor)}`, true);
        if (res.status === 401) {
          toast.error('Session expired. Please sign in again.');
          router.replace('/');
          return;
        }
      }
      if (!res.ok) return;
      const data = await res.json();
      setLogs(prev => [...prev, ...(data.logs ?? [])]);
      setCursor(data.nextCursor ?? null);
      setHasMore(data.hasMore ?? false);
    } finally { setLoadingMore(false); }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Network</label>
          <select value={network} onChange={e => setNetwork(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white">
            <option value="">All</option>
            {NETWORKS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Error Code</label>
          <input type="text" value={errorCode} onChange={e => setErrorCode(e.target.value)} placeholder="e.g. RATE_LIMIT"
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white w-36" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">From</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">To</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white" />
        </div>
      </div>

      {loading && (
        <div className="animate-pulse space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded" />
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-500">
          <AlertCircle className="w-4 h-4" /> Failed to load error logs.
          <button onClick={fetchLogs} className="underline text-xs">Retry</button>
        </div>
      )}

      {!loading && !error && (
        <>
          {logs.length === 0 ? (
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">No error logs found.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                    {['Timestamp', 'Network', 'Error', 'Category', 'Attempt', 'Backoff'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-700 dark:text-gray-300 capitalize">{log.networkId}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-700 dark:text-gray-300 max-w-[200px] truncate">{log.errorMessage}</td>
                      <td className="px-3 py-2.5">
                        <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">{log.errorCategory}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400">{log.attemptNumber}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400">{log.backoffDelay}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {hasMore && (
            <div className="text-center">
              <button onClick={loadMore} disabled={loadingMore}
                className="flex items-center gap-2 mx-auto px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50">
                {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Load more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
