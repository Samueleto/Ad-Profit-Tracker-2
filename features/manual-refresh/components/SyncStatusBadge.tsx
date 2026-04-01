'use client';

import { Loader2 } from 'lucide-react';

export type SyncStatus = 'success' | 'failed' | 'never' | 'in_progress';

interface SyncStatusBadgeProps {
  status: SyncStatus;
}

export default function SyncStatusBadge({ status }: SyncStatusBadgeProps) {
  switch (status) {
    case 'success':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
          Success
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">
          Failed
        </span>
      );
    case 'in_progress':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
          <Loader2 className="w-3 h-3 animate-spin" />
          Syncing
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          Never
        </span>
      );
  }
}
