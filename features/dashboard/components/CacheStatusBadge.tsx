'use client';

import { differenceInMinutes } from 'date-fns';

interface CacheStatusBadgeProps {
  cachedAt: string | null;
}

export default function CacheStatusBadge({ cachedAt }: CacheStatusBadgeProps) {
  if (!cachedAt) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
        Live
      </span>
    );
  }

  const minutesAgo = differenceInMinutes(new Date(), new Date(cachedAt));

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
      Cached · {minutesAgo}m ago
    </span>
  );
}
