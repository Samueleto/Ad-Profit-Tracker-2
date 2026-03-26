'use client';

import type { ActivityFeedEntry } from '../types';
import { formatRelativeTime } from '../utils';

interface ActivityFeedListProps {
  entries: ActivityFeedEntry[];
}

const NETWORK_LABELS: Record<string, string> = {
  exoclick: 'ExoClick',
  rollerads: 'RollerAds',
  zeydoo: 'Zeydoo',
  propush: 'Propush',
};

export default function ActivityFeedList({ entries }: ActivityFeedListProps) {
  if (!entries || entries.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 py-2">No recent activity.</p>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map(entry => (
        <div key={entry.id} className="flex items-start gap-2.5 text-xs">
          <span
            className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
              entry.status === 'success' ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-medium text-gray-800 dark:text-gray-200">
                {NETWORK_LABELS[entry.networkId] ?? entry.networkId}
              </span>
              <span className="text-gray-500 dark:text-gray-400">{entry.eventLabel}</span>
              {entry.rowsFetched != null && (
                <span className="text-gray-500 dark:text-gray-400">· {entry.rowsFetched} rows</span>
              )}
              {entry.latencyMs != null && (
                <span className="text-gray-500 dark:text-gray-400">
                  · {entry.latencyMs < 1000 ? `${entry.latencyMs}ms` : `${(entry.latencyMs / 1000).toFixed(1)}s`}
                </span>
              )}
            </div>
            <p className="text-gray-400 dark:text-gray-500 mt-0.5">{formatRelativeTime(entry.createdAt)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
