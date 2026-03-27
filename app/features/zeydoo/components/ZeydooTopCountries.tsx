'use client';

import { useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { useZeydooStatsByCountry } from '../hooks/useZeydooStats';

interface ZeydooTopCountriesProps {
  dateFrom: string;
  dateTo: string;
  syncVersion?: number;
}

export default function ZeydooTopCountries({ dateFrom, dateTo, syncVersion = 0 }: ZeydooTopCountriesProps) {
  const [limit, setLimit] = useState(20);
  const { countries, isLoading, error } = useZeydooStatsByCountry(dateFrom, dateTo, limit, syncVersion);
  const rows = countries ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 dark:text-gray-400">Top countries by revenue</p>
        <select value={limit} onChange={e => setLimit(Number(e.target.value))}
          className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white">
          {[20, 50, 100].map(n => <option key={n} value={n}>Top {n}</option>)}
        </select>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading countries…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-500">
          <AlertCircle className="w-4 h-4" /> Failed to load country data.
        </div>
      )}

      {!isLoading && !error && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                {['Country', 'Revenue', 'Share'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    No country data for this period.
                  </td>
                </tr>
              ) : (rows as Array<{ countryCode: string; countryName?: string; flagEmoji?: string; revenue: number; revenueShare?: number }>).map((row) => (
                <tr key={row.countryCode} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-3 py-2.5 text-gray-900 dark:text-gray-100">
                    {row.flagEmoji && <span className="mr-1.5">{row.flagEmoji}</span>}
                    {row.countryName || row.countryCode}
                  </td>
                  <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">${Number(row.revenue).toFixed(4)}</td>
                  <td className="px-3 py-2.5">
                    {row.revenueShare != null ? (
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(row.revenueShare, 100)}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">{Number(row.revenueShare).toFixed(1)}%</span>
                      </div>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
