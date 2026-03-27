'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Loader2 } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import { useDateRangeStore } from '@/store/dateRangeStore';
import CountryTrendChart from './CountryTrendChart';
import type { GeoSnapshotDayPoint, GeoNetworkContribution } from '../types';

interface GeoCountryDrilldownModalProps {
  countryCode: string;
  countryName: string;
  flagEmoji: string;
  onClose: () => void;
}

async function authFetch(path: string): Promise<Response> {
  const auth = getAuth();
  let token = await auth.currentUser?.getIdToken();
  let res = await fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: 'no-store',
  });
  if (res.status === 401) {
    token = await auth.currentUser?.getIdToken(true);
    res = await fetch(path, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: 'no-store',
    });
  }
  return res;
}

export default function GeoCountryDrilldownModal({
  countryCode,
  countryName,
  flagEmoji,
  onClose,
}: GeoCountryDrilldownModalProps) {
  const { fromDate, toDate } = useDateRangeStore();
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<GeoSnapshotDayPoint[]>([]);
  const [networkBreakdown, setNetworkBreakdown] = useState<GeoNetworkContribution[]>([]);
  const [empty, setEmpty] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(
        `/api/stats/snapshot?country=${countryCode}&from=${fromDate}&to=${toDate}`
      );
      if (!res.ok) { setEmpty(true); return; }
      const data = await res.json();
      const days: GeoSnapshotDayPoint[] = data.days ?? [];
      const networks: GeoNetworkContribution[] = data.networkBreakdown ?? [];
      if (days.length === 0 && networks.length === 0) { setEmpty(true); return; }
      setChartData(days);
      setNetworkBreakdown(networks);
    } catch {
      setEmpty(true);
    } finally {
      setLoading(false);
    }
  }, [countryCode, fromDate, toDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const ROLE_COLORS: Record<string, string> = {
    'Cost Only': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    'Revenue Only': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    'Both': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full z-50 w-full sm:max-w-[480px] bg-white dark:bg-gray-900 shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {flagEmoji} {countryName}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {fromDate} – {toDate}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {loading ? (
            <>
              {/* Chart skeleton */}
              <div className="h-[200px] bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
              {/* Network table skeleton */}
              <div className="space-y-2 animate-pulse">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded ml-auto" />
                  </div>
                ))}
              </div>
            </>
          ) : empty ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-10 gap-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No data available for {countryName} in this period.
              </p>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              {/* Daily profit chart */}
              <div>
                <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Net Profit Trend
                </h3>
                <CountryTrendChart data={chartData} />
              </div>

              {/* Per-network breakdown */}
              {networkBreakdown.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">
                    Network Breakdown
                  </h3>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-1.5 pr-3 font-medium">Network</th>
                        <th className="text-left py-1.5 pr-3 font-medium">Role</th>
                        <th className="text-right py-1.5 pr-3 font-medium">Value</th>
                        <th className="text-right py-1.5 font-medium">% of Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {networkBreakdown.map((n, i) => (
                        <tr key={i}>
                          <td className="py-1.5 pr-3 text-gray-900 dark:text-gray-100">{n.networkName}</td>
                          <td className="py-1.5 pr-3">
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${ROLE_COLORS[n.dataRole] ?? ''}`}>
                              {n.dataRole}
                            </span>
                          </td>
                          <td className="py-1.5 pr-3 text-right text-gray-900 dark:text-gray-100">
                            {n.primaryMetricValue != null ? `$${n.primaryMetricValue.toFixed(2)}` : '—'}
                          </td>
                          <td className="py-1.5 text-right text-gray-700 dark:text-gray-300">
                            {n.percentageOfTotal.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="pt-2">
                <button
                  onClick={() => {
                    onClose();
                    setTimeout(() => {
                      document.getElementById('daily-trend')?.scrollIntoView({ behavior: 'smooth' });
                    }, 100);
                  }}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  View Full Trend →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
