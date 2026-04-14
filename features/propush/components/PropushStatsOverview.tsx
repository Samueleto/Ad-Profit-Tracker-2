'use client';

import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertCircle } from 'lucide-react';
import { usePropushStats } from '../hooks/usePropushStats';

interface PropushStatsOverviewProps {
  dateFrom: string;
  dateTo: string;
  onDateChange: (from: string, to: string) => void;
}

export default function PropushStatsOverview({ dateFrom, dateTo, onDateChange }: PropushStatsOverviewProps) {
  const [groupBy, setGroupBy] = useState<'day' | 'total'>('day');
  const [rangeError, setRangeError] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = usePropushStats(
    rangeError ? '' : dateFrom,
    rangeError ? '' : dateTo,
    groupBy,
  );

  const handleFrom = (v: string) => {
    const diff = Math.round((new Date(dateTo).getTime() - new Date(v).getTime()) / 86400000);
    setRangeError(diff > 90 ? 'Date range cannot exceed 90 days.' : null);
    onDateChange(v, dateTo);
  };

  const handleTo = (v: string) => {
    const diff = Math.round((new Date(v).getTime() - new Date(dateFrom).getTime()) / 86400000);
    setRangeError(diff > 90 ? 'Date range cannot exceed 90 days.' : null);
    onDateChange(dateFrom, v);
  };

  const d = data as Record<string, unknown> | null | undefined;
  const rows = (d?.rows as unknown[] | undefined) ?? [];
  const totals = d?.totals as Record<string, unknown> | undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">From</label>
          <input type="date" value={dateFrom} onChange={e => handleFrom(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">To</label>
          <input type="date" value={dateTo} onChange={e => handleTo(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white" />
        </div>
        <div className="flex gap-1">
          {(['day', 'total'] as const).map(g => (
            <button key={g} onClick={() => setGroupBy(g)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                groupBy === g
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {g === 'day' ? 'By Day' : 'Total'}
            </button>
          ))}
        </div>
      </div>

      {rangeError && (
        <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4" /> {rangeError}
        </div>
      )}

      {isLoading && !rangeError && (
        <div className="h-48 animate-pulse bg-gray-100 dark:bg-gray-800 rounded-xl" />
      )}

      {error && !rangeError && (
        <div className="flex items-center gap-2 text-sm text-red-500">
          <AlertCircle className="w-4 h-4" /> Failed to load stats.
          <button onClick={() => refetch()} className="text-xs underline">Retry</button>
        </div>
      )}

      {!isLoading && !error && !rangeError && groupBy === 'day' && rows.length > 0 && (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="revenue" stroke="#3b82f6" dot={false} name="Revenue ($)" />
              <Line type="monotone" dataKey="clicks" stroke="#10b981" dot={false} name="Clicks" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {!isLoading && !error && !rangeError && groupBy === 'day' && rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                {['Date', 'Revenue', 'Impressions', 'Clicks'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {(rows as Array<{ date: string; revenue: number; impressions: number; clicks: number }>).map((row) => (
                <tr key={row.date} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-3 py-2.5 font-mono text-xs text-gray-900 dark:text-gray-100">{row.date}</td>
                  <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">${Number(row.revenue).toFixed(4)}</td>
                  <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{Number(row.impressions).toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{Number(row.clicks).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && !error && !rangeError && groupBy === 'total' && totals && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: 'Total Revenue', value: `$${Number(totals.revenue ?? 0).toFixed(4)}` },
            { label: 'Impressions', value: Number(totals.impressions ?? 0).toLocaleString() },
            { label: 'Clicks', value: Number(totals.clicks ?? 0).toLocaleString() },
          ].map(s => (
            <div key={s.label} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {!isLoading && !error && !rangeError && rows.length === 0 && (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-10">
          No data for this period. Run a sync to pull Propush stats.
        </p>
      )}
    </div>
  );
}
