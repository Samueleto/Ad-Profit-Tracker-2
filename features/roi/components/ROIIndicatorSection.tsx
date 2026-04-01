'use client';

import { AlertTriangle, Settings } from 'lucide-react';
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
  state: 'loading' | 'empty' | 'error_500' | 'success';
  roi?: number | null;
  roiChange?: number | null;
  revenue?: number;
  cost?: number;
  networkContributions?: NetworkContribution[];
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
  onRetry,
  positiveThreshold,
  warningThreshold,
  onConfigureThresholds,
}: ROIIndicatorSectionProps) {
  if (state === 'loading') {
    return <ROIKPICard roi={null} roiChange={null} isLoading />;
  }

  if (state === 'empty') {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-700 dark:text-amber-400">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        No data for selected range
      </div>
    );
  }

  if (state === 'error_500') {
    return (
      <div className="flex items-center justify-between px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
        <span className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Failed to load ROI data.
        </span>
        {onRetry && (
          <button onClick={onRetry} className="text-xs underline">
            Retry
          </button>
        )}
      </div>
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
        {onConfigureThresholds && (
          <button
            onClick={onConfigureThresholds}
            className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            title="Configure thresholds"
            aria-label="Configure ROI thresholds"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {networkContributions.length > 0 && (
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
      )}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2">
        <ROIBreakdownPanel revenue={revenue} cost={cost} roi={roi ?? null} />
      </div>
    </div>
  );
}
