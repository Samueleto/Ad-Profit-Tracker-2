'use client';

import { AlertTriangle, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import ROIKPICard from './ROIKPICard';
import ROIBreakdownPanel from './ROIBreakdownPanel';
import ROINetworkContributionRow from './ROINetworkContributionRow';

interface NetworkContribution {
  networkId: string;
  networkName: string;
  revenue: number | null;
  roi: number | null;
}

interface ROIIndicatorSectionProps {
  state: 'loading' | 'empty' | 'error_500' | 'error_401' | 'error_403' | 'success';
  roi?: number | null;
  roiChange?: number | null;
  revenue?: number;
  cost?: number;
  networkContributions?: NetworkContribution[];
  breakdownError?: boolean;
  onRetry?: () => void;
  positiveThreshold?: number;
  warningThreshold?: number;
  onConfigureThresholds?: () => void;
}

export default function ROIIndicatorSection({
  state,
  roi,
  roiChange,
  revenue = 0,
  cost = 0,
  networkContributions = [],
  breakdownError = false,
  onRetry,
  positiveThreshold,
  warningThreshold,
  onConfigureThresholds,
}: ROIIndicatorSectionProps) {
  // CSS shimmer placeholder matching card dimensions
  if (state === 'loading') {
    return (
      <div className="space-y-2">
        <div className="h-28 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
        <div className="h-10 rounded-xl bg-gray-100 dark:bg-gray-800/60 animate-pulse" />
      </div>
    );
  }

  // No data for selected range — amber N/A badge
  if (state === 'empty') {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
        <span className="text-sm text-amber-700 dark:text-amber-400 flex-1">No data for selected range</span>
        <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-xs font-semibold rounded">
          N/A
        </span>
      </div>
    );
  }

  // Inline error — don't take over the whole page
  if (state === 'error_500') {
    return (
      <div className="flex items-center justify-between px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
        <span className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Unable to load ROI data
        </span>
        {onRetry && (
          <button onClick={onRetry} className="text-xs text-red-700 dark:text-red-400 underline hover:no-underline ml-3">
            Retry
          </button>
        )}
      </div>
    );
  }

  // 403 — Access Denied inline card
  if (state === 'error_403') {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
        <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0" />
        <span className="text-sm text-red-700 dark:text-red-400 flex-1">Access Denied</span>
        <Link href="/dashboard" className="text-xs text-red-700 dark:text-red-400 underline hover:no-underline">
          Go to Dashboard
        </Link>
      </div>
    );
  }

  // 401 handled by parent (redirect) — show nothing or a brief message while redirecting
  if (state === 'error_401') {
    return (
      <div className="h-28 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
    );
  }

  // success
  return (
    <div className="space-y-2">
      <div className="relative">
        <ROIKPICard
          roi={roi ?? null}
          roiChange={roiChange ?? null}
          positiveThreshold={positiveThreshold}
          warningThreshold={warningThreshold}
        />
      </div>

      {/* Per-network breakdown — soft failure if unavailable */}
      {breakdownError ? (
        <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl">
          Network breakdown unavailable
        </div>
      ) : networkContributions.length > 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 divide-y divide-gray-100 dark:divide-gray-800">
          {networkContributions.map(n => (
            <ROINetworkContributionRow
              key={n.networkId}
              networkName={n.networkName}
              revenue={n.revenue}
              roi={n.roi}
            />
          ))}
        </div>
      ) : null}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2">
        <ROIBreakdownPanel revenue={revenue} cost={cost} roi={roi ?? null} />
      </div>
    </div>
  );
}
