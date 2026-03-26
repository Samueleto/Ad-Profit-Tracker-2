'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown, Loader2, AlertCircle } from 'lucide-react';
import { useExoClickStatsByCountry } from '../hooks/useExoClickStats';

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 6);
  return { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] };
}

type SortKey = 'cost' | 'costShare' | 'impressions' | 'clicks' | 'ctr';

interface CountryRow {
  countryCode: string;
  countryName: string;
  flagEmoji?: string;
  cost: number;
  costShare: number;
  impressions: number;
  clicks: number;
  ctr: number;
}

const COLUMNS: { key: SortKey | 'country'; label: string }[] = [
  { key: 'country', label: 'Country' },
  { key: 'cost', label: 'Cost' },
  { key: 'costShare', label: 'Cost Share' },
  { key: 'impressions', label: 'Impressions' },
  { key: 'clicks', label: 'Clicks' },
  { key: 'ctr', label: 'CTR' },
];

export default function ExoClickCountryBreakdownView() {
  const init = defaultRange();
  const [dateFrom, setDateFrom] = useState(init.from);
  const [dateTo, setDateTo] = useState(init.to);
  const [limit, setLimit] = useState(20);
  const [sortKey, setSortKey] = useState<SortKey>('cost');
  const [sortAsc, setSortAsc] = useState(false);

  const { data, isLoading, error } = useExoClickStatsByCountry(dateFrom, dateTo, limit);
  const rows: CountryRow[] = data?.rows ?? data?.countries ?? [];

  const sorted = [...rows].sort((a, b) => {
    if (sortKey === 'cost') return sortAsc ? a.cost - b.cost : b.cost - a.cost;
    const av = a[sortKey] ?? 0;
    const bv = b[sortKey] ?? 0;
    return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  const toggleSort = (key: SortKey | 'country') => {
    if (key === 'country') return;
    if (sortKey === key) { setSortAsc(!sortAsc); } else { setSortKey(key); setSortAsc(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Limit</label>
          <select value={limit} onChange={e => setLimit(Number(e.target.value))}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white">
            {[20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading country data…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-500">
          <AlertCircle className="w-4 h-4" /> Failed to load country breakdown.
        </div>
      )}

      {!isLoading && !error && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className={`px-3 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap ${col.key !== 'country' ? 'cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none' : ''}`}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    No country data available for this period.
                  </td>
                </tr>
              ) : sorted.map(row => (
                <tr key={row.countryCode} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-3 py-2.5 text-gray-900 dark:text-gray-100">
                    {row.flagEmoji && <span className="mr-1.5">{row.flagEmoji}</span>}
                    {row.countryName || row.countryCode}
                  </td>
                  <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">${Number(row.cost).toFixed(4)}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(row.costShare, 100)}%` }} />
                      </div>
                      <span className="text-xs text-gray-500">{Number(row.costShare).toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{Number(row.impressions).toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{Number(row.clicks).toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{Number(row.ctr).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
