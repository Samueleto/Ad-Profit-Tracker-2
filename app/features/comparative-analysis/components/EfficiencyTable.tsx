'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { CrossNetworkMetrics } from '../types';

interface EfficiencyTableProps {
  metrics: CrossNetworkMetrics | null;
}

function fmt(v: number | null, type: 'currency' | 'percent' | 'decimal'): string {
  if (v == null) return '—';
  if (type === 'currency') return `$${v.toFixed(4)}`;
  if (type === 'percent') return `${v.toFixed(2)}%`;
  return v.toFixed(4);
}

const ROWS = [
  { label: 'Overall ROI', key: 'overallRoi' as const, type: 'percent' as const },
  { label: 'Revenue / Impression', key: 'revenuePerImpression' as const, type: 'currency' as const },
  { label: 'Cost / Click', key: 'costPerClick' as const, type: 'currency' as const },
];

export default function EfficiencyTable({ metrics }: EfficiencyTableProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-expanded={expanded}
      >
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Cross-Network Efficiency</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <table className="w-full text-sm bg-white dark:bg-gray-900">
          <tbody>
            {ROWS.map((row, i) => (
              <tr key={row.key} className={i % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800/50'}>
                <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{row.label}</td>
                <td className="px-4 py-2.5 text-right font-semibold text-gray-900 dark:text-white">
                  {fmt(metrics?.[row.key] ?? null, row.type)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
