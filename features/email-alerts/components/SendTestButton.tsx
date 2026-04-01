'use client';

import { Loader2 } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';

interface SendTestButtonProps {
  onClick: () => void;
  isLoading: boolean;
  lastTestSentAt: string | null;
}

export default function SendTestButton({ onClick, isLoading, lastTestSentAt }: SendTestButtonProps) {
  let lastSentLabel = '';
  if (lastTestSentAt) {
    try {
      lastSentLabel = formatDistanceToNow(parseISO(lastTestSentAt), { addSuffix: true });
    } catch {
      lastSentLabel = '';
    }
  }

  return (
    <div>
      <button
        onClick={onClick}
        disabled={isLoading}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
        Send Test Alert
      </button>
      {lastSentLabel && (
        <p className="mt-1 text-xs text-gray-400">Last test sent: {lastSentLabel}</p>
      )}
    </div>
  );
}
