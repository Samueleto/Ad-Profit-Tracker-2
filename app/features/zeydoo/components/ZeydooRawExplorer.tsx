'use client';

import { useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { useZeydooRawResponse } from '../hooks/useZeydooStats';

export default function ZeydooRawExplorer() {
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  });
  const [fetched, setFetched] = useState(false);

  const { data, schema, isLoading, error, fetch: fetchRaw } = useZeydooRawResponse();
  const d = data as Record<string, unknown> | null;
  const records = (d?.records ?? d) as unknown[] | null;

  const status = (error as unknown as { status?: number } | null)?.status;

  const handleFetch = () => {
    setFetched(true);
    fetchRaw(date);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white" />
        </div>
        <button
          onClick={handleFetch}
          className="px-4 py-1.5 text-sm font-medium bg-gray-700 hover:bg-gray-800 text-white rounded-lg transition-colors"
        >
          Fetch Raw
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading raw response…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-500">
          <AlertCircle className="w-4 h-4" />
          {status === 404 ? 'No data for this date — try syncing first.' : 'Failed to load raw response.'}
        </div>
      )}

      {!!data && !isLoading && (
        <div className="space-y-4">
          {!!schema && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Field Schema</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      {['Field', 'Type', 'Description'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {(schema as Array<{ field: string; type: string; description?: string }>).map((f, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-mono text-gray-900 dark:text-gray-100">{f.field}</td>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{f.type}</td>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{f.description ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Raw Records ({Array.isArray(records) ? records.length : 0})
            </h4>
            <pre className="text-xs bg-gray-100 dark:bg-gray-900 rounded-lg p-3 overflow-auto max-h-80 font-mono text-gray-700 dark:text-gray-300">
              {JSON.stringify(records, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {!fetched && !isLoading && (
        <p className="text-xs text-gray-400 dark:text-gray-500">Pick a date and click Fetch Raw to view the raw API response.</p>
      )}
    </div>
  );
}
