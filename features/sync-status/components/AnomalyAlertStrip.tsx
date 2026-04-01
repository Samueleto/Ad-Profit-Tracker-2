'use client';

import { AlertTriangle } from 'lucide-react';

interface AnomalyAlertStripProps {
  criticalCount: number;
  onViewDetails: () => void;
}

export default function AnomalyAlertStrip({ criticalCount, onViewDetails }: AnomalyAlertStripProps) {
  if (criticalCount === 0) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm">
      <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
      <span className="text-red-700 dark:text-red-300 flex-1">
        {criticalCount} critical {criticalCount === 1 ? 'anomaly' : 'anomalies'} detected
      </span>
      <button
        onClick={onViewDetails}
        className="text-xs text-red-700 dark:text-red-400 underline hover:no-underline"
      >
        View Details
      </button>
    </div>
  );
}
