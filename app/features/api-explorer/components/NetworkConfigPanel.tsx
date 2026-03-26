'use client';

import type { NetworkConfig } from '../types';

interface NetworkConfigPanelProps {
  config: NetworkConfig | null;
  isLoading?: boolean;
}

export default function NetworkConfigPanel({ config, isLoading }: NetworkConfigPanelProps) {
  if (isLoading || !config) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
        <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Endpoint URL */}
      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Endpoint URL</p>
        <code className="block text-xs font-mono bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-3 py-2 rounded-lg break-all">
          {config.endpointUrl}
        </code>
      </div>

      {/* HTTP Method */}
      <div className="flex items-center gap-2">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Method:</p>
        <span
          className={`px-2 py-0.5 text-xs font-semibold rounded ${
            config.httpMethod === 'POST'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
          }`}
        >
          {config.httpMethod}
        </span>
      </div>

      {/* Required Params */}
      {config.requiredParams.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Required Parameters</p>
          <table className="w-full text-xs border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400 w-1/3">Name</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {config.requiredParams.map(p => (
                <tr key={p.name} className="bg-white dark:bg-gray-900">
                  <td className="px-3 py-2 font-mono text-gray-800 dark:text-gray-200">{p.name}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{p.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
