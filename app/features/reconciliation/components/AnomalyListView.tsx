'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAuth } from 'firebase/auth';
import { AlertCircle, Loader2, X } from 'lucide-react';

const NETWORKS = ['exoclick', 'rollerads', 'zeydoo', 'propush'];
const SEVERITY_OPTIONS = ['all', 'warning', 'critical'] as const;
const RESOLUTION_TYPES = ['acknowledged', 'corrected', 'false_positive'] as const;

interface AnomalyFlag {
  type: string;
  severity: 'warning' | 'critical';
}

interface Anomaly {
  id: string;
  date: string;
  networkId: string;
  country?: string;
  validationStatus: string;
  anomalyFlags: AnomalyFlag[];
  cost?: number;
  revenue?: number;
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

export default function AnomalyListView({ initialNetwork = '', onAllResolved }: { initialNetwork?: string; onAllResolved?: (networkId: string) => void }) {
  const [network, setNetwork] = useState(initialNetwork);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [severity, setSeverity] = useState<typeof SEVERITY_OPTIONS[number]>('all');
  const [anomalyType, setAnomalyType] = useState('');
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [resolving, setResolving] = useState(false);
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [resolutionType, setResolutionType] = useState<typeof RESOLUTION_TYPES[number]>('acknowledged');
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolveError, setResolveError] = useState<string | null>(null);

  // Sync network filter when parent deep-links with a new networkId
  const initialNetworkRef = useRef(initialNetwork);
  useEffect(() => {
    if (initialNetwork !== initialNetworkRef.current) {
      initialNetworkRef.current = initialNetwork;
      setNetwork(initialNetwork);
    }
  }, [initialNetwork]);

  const buildQuery = (cur?: string | null) => {
    const p = new URLSearchParams();
    if (network) p.set('networkId', network);
    if (startDate) p.set('startDate', startDate);
    if (endDate) p.set('endDate', endDate);
    if (severity !== 'all') p.set('severity', severity);
    if (anomalyType) p.set('type', anomalyType);
    if (cur) p.set('cursor', cur);
    return p.toString();
  };

  const fetchAnomalies = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    setSelected(new Set());
    try {
      const res = await authFetch(`/api/reconciliation/anomalies?${buildQuery()}`);
      if (!res.ok) { setFetchError(true); return; }
      const data = await res.json();
      setAnomalies(data.anomalies ?? []);
      setCursor(data.nextCursor ?? null);
      setHasMore(data.hasMore ?? false);
    } catch { setFetchError(true); }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network, startDate, endDate, severity, anomalyType]);

  useEffect(() => { fetchAnomalies(); }, [fetchAnomalies]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const res = await authFetch(`/api/reconciliation/anomalies?${buildQuery(cursor)}`);
      if (!res.ok) return;
      const data = await res.json();
      setAnomalies(prev => [...prev, ...(data.anomalies ?? [])]);
      setCursor(data.nextCursor ?? null);
      setHasMore(data.hasMore ?? false);
    } finally { setLoadingMore(false); }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else if (next.size < 50) { next.add(id); }
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === anomalies.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(anomalies.slice(0, 50).map(a => a.id)));
    }
  };

  const handleResolve = async () => {
    setResolving(true);
    setResolveError(null);
    try {
      const res = await authFetch('/api/reconciliation/resolve', {
        method: 'PATCH',
        body: JSON.stringify({
          ids: [...selected],
          resolution: resolutionType,
          note: resolutionNote || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setResolveError(data.error ?? 'Resolve failed.');
        return;
      }
      setSelected(new Set());
      setShowResolveForm(false);
      setResolutionNote('');
      // Refetch and check if all anomalies for this network are now resolved
      setLoading(true);
      setFetchError(false);
      try {
        const listRes = await authFetch(`/api/reconciliation/anomalies?${buildQuery()}`);
        if (!listRes.ok) { setFetchError(true); return; }
        const data = await listRes.json();
        const updated = data.anomalies ?? [];
        setAnomalies(updated);
        setCursor(data.nextCursor ?? null);
        setHasMore(data.hasMore ?? false);
        if (updated.length === 0 && network) {
          onAllResolved?.(network);
        }
      } catch { setFetchError(true); }
      finally { setLoading(false); }
    } finally { setResolving(false); }
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
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">From</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">To</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Severity</label>
          <div className="flex gap-1">
            {SEVERITY_OPTIONS.map(s => (
              <button key={s} onClick={() => setSeverity(s)}
                className={`px-2.5 py-1.5 text-xs rounded-lg border capitalize transition-colors ${
                  severity === s ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >{s}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Type</label>
          <input type="text" value={anomalyType} onChange={e => setAnomalyType(e.target.value)} placeholder="e.g. revenue_spike"
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white w-40" />
        </div>
      </div>

      {/* Bulk resolve bar */}
      {selected.size > 0 && !showResolveForm && (
        <div className="flex items-center gap-3 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <span className="text-xs text-blue-700 dark:text-blue-400">{selected.size} selected</span>
          <button onClick={() => setShowResolveForm(true)}
            className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
            Resolve Selected
          </button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Resolve form */}
      {showResolveForm && (
        <div className="border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-gray-900 dark:text-white">Resolve {selected.size} record(s)</p>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Resolution Type</label>
            <div className="flex gap-2">
              {RESOLUTION_TYPES.map(r => (
                <button key={r} onClick={() => setResolutionType(r)}
                  className={`px-3 py-1 text-xs rounded-lg border capitalize transition-colors ${
                    resolutionType === r ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                  }`}
                >{r.replace(/_/g, ' ')}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Note (optional)</label>
            <textarea
              value={resolutionNote}
              onChange={e => setResolutionNote(e.target.value.slice(0, 500))}
              rows={2}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white resize-none"
              placeholder="Add a resolution note…"
            />
            <p className="text-xs text-gray-400 mt-0.5">{resolutionNote.length}/500</p>
          </div>
          {resolveError && <p className="text-xs text-red-500">{resolveError}</p>}
          <div className="flex gap-2">
            <button onClick={handleResolve} disabled={resolving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors">
              {resolving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Confirm Resolve
            </button>
            <button onClick={() => setShowResolveForm(false)} disabled={resolving}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="animate-pulse space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded" />
          ))}
        </div>
      )}

      {fetchError && (
        <div className="flex items-center gap-2 text-sm text-red-500">
          <AlertCircle className="w-4 h-4" /> Failed to load anomalies.
          <button onClick={fetchAnomalies} className="underline text-xs">Retry</button>
        </div>
      )}

      {!loading && !fetchError && (
        anomalies.length === 0 ? (
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-10">No anomalies found for this period.</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                    <th className="px-3 py-2.5">
                      <input type="checkbox" checked={selected.size === anomalies.length && anomalies.length > 0}
                        onChange={toggleAll} className="rounded" />
                    </th>
                    {['Date', 'Network', 'Country', 'Status', 'Flags', 'Cost', 'Revenue'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {anomalies.map(anomaly => (
                    <tr key={anomaly.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${selected.has(anomaly.id) ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}>
                      <td className="px-3 py-2.5">
                        <input type="checkbox" checked={selected.has(anomaly.id)} onChange={() => toggleSelect(anomaly.id)} className="rounded" />
                      </td>
                      <td className="px-3 py-2.5 text-xs font-mono text-gray-700 dark:text-gray-300">{anomaly.date}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-700 dark:text-gray-300 capitalize">{anomaly.networkId}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400">{anomaly.country ?? '—'}</td>
                      <td className="px-3 py-2.5 text-xs">
                        <span className={`px-2 py-0.5 rounded-full ${
                          anomaly.validationStatus === 'anomaly' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}>{anomaly.validationStatus}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {(anomaly.anomalyFlags ?? []).slice(0, 2).map((f, i) => (
                            <span key={i} className={`px-1.5 py-0.5 text-xs rounded ${
                              f.severity === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            }`}>{f.type}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-700 dark:text-gray-300">
                        {anomaly.cost != null ? `$${Number(anomaly.cost).toFixed(4)}` : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-700 dark:text-gray-300">
                        {anomaly.revenue != null ? `$${Number(anomaly.revenue).toFixed(4)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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
        )
      )}
    </div>
  );
}
