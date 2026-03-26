'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import { AlertCircle } from 'lucide-react';

interface NetworkSummary {
  networkId: string;
  successRate: number;
  failureCount: number;
}

interface SummaryData {
  overallSuccessRate: number;
  totalFailures: number;
  mostProblematicNetwork?: string | null;
  networks: NetworkSummary[];
}

function toISODate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

async function authFetch(path: string): Promise<Response> {
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken();
  return fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
}

export default function ErrorSummaryWidget() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchSummary = useCallback(async (d: number) => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams({ startDate: toISODate(d), endDate: new Date().toISOString().split('T')[0] });
      const res = await authFetch(`/api/errors/summary?${params}`);
      if (!res.ok) { setError(true); return; }
      setData(await res.json());
    } catch { setError(true); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSummary(days); }, [fetchSummary, days]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="flex gap-4">
          <div className="h-12 w-28 bg-gray-100 dark:bg-gray-800 rounded-xl" />
          <div className="h-12 w-28 bg-gray-100 dark:bg-gray-800 rounded-xl" />
        </div>
        <div className="h-20 bg-gray-100 dark:bg-gray-800 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-500">
        <AlertCircle className="w-4 h-4" /> Failed to load error summary.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          {[7, 14, 30].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                days === d
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-4">
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 flex-1">
          <p className="text-xs text-green-600 dark:text-green-400">Success Rate</p>
          <p className="text-2xl font-bold text-green-700 dark:text-green-300">
            {data ? `${(data.overallSuccessRate * 100).toFixed(1)}%` : '—'}
          </p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex-1">
          <p className="text-xs text-red-600 dark:text-red-400">Total Failures</p>
          <p className="text-2xl font-bold text-red-700 dark:text-red-300">{data?.totalFailures ?? 0}</p>
        </div>
      </div>

      {data?.networks && data.networks.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                {['Network', 'Success Rate', 'Failures'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {data.networks.map(n => (
                <tr key={n.networkId} className={n.networkId === data.mostProblematicNetwork ? 'bg-amber-50 dark:bg-amber-900/10' : ''}>
                  <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100 capitalize">
                    {n.networkId}
                    {n.networkId === data.mostProblematicNetwork && (
                      <span className="ml-2 text-amber-600 dark:text-amber-400">⚠</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700 dark:text-gray-300">{(n.successRate * 100).toFixed(1)}%</td>
                  <td className="px-3 py-2 text-xs text-gray-700 dark:text-gray-300">{n.failureCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
