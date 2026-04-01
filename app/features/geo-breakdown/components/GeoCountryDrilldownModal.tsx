'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, ShieldAlert, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

type ModalState = 'loading' | 'data' | 'empty' | 'error_403' | 'error_404' | 'error_500';

async function fetchWithAuth(path: string): Promise<Response> {
  const auth = getAuth();
  let token = await auth.currentUser?.getIdToken();
  let res = await fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: 'no-store',
  });
  if (res.status === 401) {
    token = await auth.currentUser?.getIdToken(true).catch(() => undefined);
    if (!token) throw new Error('session_expired');
    res = await fetch(path, {
      headers: { Authorization: `Bearer ${token}` },
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
  const router = useRouter();
  const { fromDate, toDate } = useDateRangeStore();
  const [modalState, setModalState] = useState<ModalState>('loading');
  const [chartData, setChartData] = useState<GeoSnapshotDayPoint[]>([]);
  const [networkBreakdown, setNetworkBreakdown] = useState<GeoNetworkContribution[]>([]);

  const fetchData = useCallback(async () => {
    setModalState('loading');
    try {
      const res = await fetchWithAuth(
        `/api/stats/snapshot?country=${countryCode}&from=${fromDate}&to=${toDate}`
      );

      if (res.status === 401) {
        onClose();
        router.replace('/');
        return;
      }
      if (res.status === 403) { setModalState('error_403'); return; }
      if (res.status === 404) { setModalState('error_404'); return; }
      if (!res.ok) { setModalState('error_500'); return; }

      const data = await res.json();
      const days: GeoSnapshotDayPoint[] = data.days ?? [];
      const networks: GeoNetworkContribution[] = data.networkBreakdown ?? [];
      if (days.length === 0 && networks.length === 0) {
        setModalState('empty');
        return;
      }
      setChartData(days);
      setNetworkBreakdown(networks);
      setModalState('data');
    } catch (err) {
      if (err instanceof Error && err.message === 'session_expired') {
        onClose();
        router.replace('/');
        return;
      }
      setModalState('error_500');
    }
  }, [countryCode, fromDate, toDate, onClose, router]);

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

  const renderContent = () => {
    switch (modalState) {
      case 'loading':
        return (
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
        );
      case 'error_403':
        return (
          <div className="flex flex-col items-center justify-center h-full text-center py-10 gap-3">
            <ShieldAlert className="w-6 h-6 text-red-500" />
            <p className="text-sm text-red-600 dark:text-red-400">
              Access Denied — you don&apos;t have permission to view this data.
            </p>
            <Link href="/dashboard" className="text-xs text-blue-600 underline">Back to Dashboard</Link>
          </div>
        );
      case 'error_404':
        return (
          <div className="flex flex-col items-center justify-center h-full text-center py-10 gap-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No data found for this country.
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        );
      case 'error_500':
        return (
          <div className="flex flex-col items-center justify-center h-full text-center py-10 gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <p className="text-sm text-red-600 dark:text-red-400">
              Failed to load data. Please try again.
            </p>
            <button
              onClick={fetchData}
              className="px-4 py-2 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
            >
              Retry
            </button>
          </div>
        );
      case 'empty':
        return (
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
        );
      case 'data':
        return (
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
        );
    }
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
          {renderContent()}
        </div>
      </div>
    </>
  );
}
