'use client';

import type { NetworkRankingItem } from '../types';

interface NetworkRankingStripProps {
  rankings: NetworkRankingItem[];
  networkLabels: Record<string, string>;
}

const MEDAL: Record<number, { label: string; class: string }> = {
  1: { label: '1st', class: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 font-bold' },
  2: { label: '2nd', class: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200' },
  3: { label: '3rd', class: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
};

export default function NetworkRankingStrip({ rankings, networkLabels }: NetworkRankingStripProps) {
  if (!rankings || rankings.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3">
      {rankings.map(r => {
        const medal = MEDAL[r.rank] ?? { label: `${r.rank}th`, class: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' };
        return (
          <div
            key={r.networkId}
            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg"
          >
            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs ${medal.class}`}>
              {medal.label}
            </span>
            <div>
              <p className="text-xs font-medium text-gray-900 dark:text-white">
                {networkLabels[r.networkId] ?? r.networkId}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{r.metricLabel}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
