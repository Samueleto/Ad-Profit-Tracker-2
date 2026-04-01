'use client';

import Link from 'next/link';
import { KeyRound } from 'lucide-react';

export default function ApiKeyMissingBanner() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
      <KeyRound className="w-4 h-4 text-amber-500 flex-shrink-0" />
      <div className="flex items-center gap-1 text-sm text-amber-700 dark:text-amber-300">
        <span>API key not configured.</span>
        <Link
          href="/settings"
          className="underline hover:no-underline font-medium"
        >
          Go to Settings
        </Link>
        <span>to add your key.</span>
      </div>
    </div>
  );
}
