'use client';

import { AlertTriangle } from 'lucide-react';

interface NotificationErrorBannerProps {
  code: number;
  onRetry?: () => void;
  onClose?: () => void;
}

export default function NotificationErrorBanner({ code, onRetry, onClose }: NotificationErrorBannerProps) {
  if (code === 403) {
    return (
      <div className="flex items-center justify-between px-4 py-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-700">
        <span className="text-xs text-red-700 dark:text-red-300">Access Denied</span>
        <button onClick={onClose} className="text-xs text-red-600 underline">Close</button>
      </div>
    );
  }
  if (code === 404) {
    return (
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xs text-gray-500">No notifications found</span>
        <button onClick={onClose} className="text-xs text-gray-500 underline">Close</button>
      </div>
    );
  }
  // 500
  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-700">
      <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
      <span className="text-xs text-red-700 dark:text-red-300 flex-1">Failed to load notifications.</span>
      {onRetry && (
        <button onClick={onRetry} className="text-xs text-red-600 dark:text-red-400 underline hover:no-underline">
          Retry
        </button>
      )}
    </div>
  );
}
