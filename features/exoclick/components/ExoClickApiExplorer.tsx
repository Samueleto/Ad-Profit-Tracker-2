'use client';

import { useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { useExoClickRawResponse } from '../hooks/useExoClickStats';

export default function ExoClickApiExplorer() {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const { records, fieldSchema, isLoading, error, refetch } = useExoClickRawResponse(date);
  const hasData = records !== null && records !== undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
        />
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading raw response…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-500">
          <AlertCircle className="w-4 h-4" />
          {(error as { message?: string }).message ?? 'Error loading response'}
          <button onClick={() => refetch()} className="underline">Retry</button>
        </div>
      )}

      {hasData && (
        <div className="space-y-4">
          {/* Field Schema */}
          {fieldSchema && (
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
                    {(fieldSchema as Array<{ field: string; type: string; description?: string }>).map((f, i: number) => (
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

          {/* Raw records */}
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
    </div>
  );
}
