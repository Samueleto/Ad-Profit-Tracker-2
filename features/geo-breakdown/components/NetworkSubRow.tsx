'use client';

import type { GeoNetworkContribution } from '../types';

interface NetworkSubRowProps {
  contributions: GeoNetworkContribution[];
}

export default function NetworkSubRow({ contributions }: NetworkSubRowProps) {
  const ROLE_COLORS: Record<string, string> = {
    'Cost Only': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    'Revenue Only': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    'Both': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  };

  return (
    <tr>
      <td colSpan={8} className="px-0 py-0">
        <div className="ml-8 border-l-2 border-gray-200 dark:border-gray-700 pl-3 pb-2 pt-1">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 dark:text-gray-400">
                <th className="text-left py-1 pr-3 font-medium">Network</th>
                <th className="text-left py-1 pr-3 font-medium">Role</th>
                <th className="text-right py-1 pr-3 font-medium">Value</th>
                <th className="text-right py-1 font-medium">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {contributions.map((c, i) => (
                <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="py-1 pr-3 text-gray-900 dark:text-gray-100">{c.networkName}</td>
                  <td className="py-1 pr-3">
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${ROLE_COLORS[c.dataRole] ?? ''}`}>
                      {c.dataRole}
                    </span>
                  </td>
                  <td className="py-1 pr-3 text-right text-gray-900 dark:text-gray-100">
                    {c.primaryMetricValue != null ? `$${c.primaryMetricValue.toFixed(2)}` : '—'}
                  </td>
                  <td className="py-1 text-right text-gray-700 dark:text-gray-300">
                    {c.percentageOfTotal.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  );
}
