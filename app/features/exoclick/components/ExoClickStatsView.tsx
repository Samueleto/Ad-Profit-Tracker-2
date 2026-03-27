'use client';

import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertCircle } from 'lucide-react';
import { useExoClickStats } from '../hooks/useExoClickStats';
import ExoClickStatsTable from './ExoClickStatsTable';

interface ExoClickStatsViewProps {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
}

export default function ExoClickStatsView({ dateFrom, dateTo, onDateFromChange, onDateToChange }: ExoClickStatsViewProps) {
  const [groupBy, setGroupBy] = useState<'day' | 'total'>('day');
  const [rangeError, setRangeError] = useState<string | null>(null);

  const diffDays = Math.round((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000);

  const { data, isLoading, error } = useExoClickStats(
    rangeError ? '' : dateFrom,
    rangeError ? '' : dateTo,
    groupBy,
  );

  const handleDateFrom = (v: string) => {
    onDateFromChange(v);
    const diff = Math.round((new Date(dateTo).getTime() - new Date(v).getTime()) / 86400000);
    setRangeError(diff > 90 ? 'Date range cannot exceed 90 days.' : null);
  };

  const handleDateTo = (v: string) => {
    onDateToChange(v);
    const diff = Math.round((new Date(v).getTime() - new Date(dateFrom).getTime()) / 86400000);
    setRangeError(diff > 90 ? 'Date range cannot exceed 90 days.' : null);
  };

  const rows = data?.rows ?? [];
  const totals = data?.totals;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => handleDateFrom(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => handleDateTo(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
          />
        </div>
        <div className="flex gap-1">
          {(['day', 'total'] as const).map(g => (
            <button
              key={g}
              onClick={() => setGroupBy(g)}
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
        </div>
      )}

      {!isLoading && !error && !rangeError && groupBy === 'day' && rows.length > 0 && (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="cost" stroke="#3b82f6" dot={false} name="Cost ($)" />
              <Line type="monotone" dataKey="clicks" stroke="#10b981" dot={false} name="Clicks" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {!isLoading && !error && !rangeError && groupBy === 'day' && (
        <ExoClickStatsTable rows={rows} />
      )}

      {!isLoading && !error && !rangeError && groupBy === 'total' && totals && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: 'Total Cost', value: `$${Number(totals.cost ?? 0).toFixed(4)}` },
            { label: 'Impressions', value: Number(totals.impressions ?? 0).toLocaleString() },
            { label: 'Clicks', value: Number(totals.clicks ?? 0).toLocaleString() },
            { label: 'CTR', value: `${Number(totals.ctr ?? 0).toFixed(2)}%` },
            { label: 'CPM', value: `$${Number(totals.cpm ?? 0).toFixed(4)}` },
            { label: 'Days', value: String(diffDays + 1) },
          ].map(s => (
            <div key={s.label} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Always show totals below */}
      {!isLoading && !error && !rangeError && totals && groupBy === 'day' && (
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Period Totals</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <span>Cost: <strong>${Number(totals.cost ?? 0).toFixed(4)}</strong></span>
            <span>Impressions: <strong>{Number(totals.impressions ?? 0).toLocaleString()}</strong></span>
            <span>Clicks: <strong>{Number(totals.clicks ?? 0).toLocaleString()}</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}
