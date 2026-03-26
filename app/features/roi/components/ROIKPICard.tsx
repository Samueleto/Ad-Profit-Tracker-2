'use client';

interface ROIKPICardProps {
  roi: number | null;
  roiChange: number | null;
  isLoading?: boolean;
}

function roiColors(roi: number | null): { text: string; bg: string } {
  if (roi === null) return { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' };
  if (roi > 0) return { text: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' };
  if (roi < 0) return { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' };
  return { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' };
}

function arrow(roi: number | null): string {
  if (roi === null || roi === 0) return '→';
  return roi > 0 ? '↑' : '↓';
}

export default function ROIKPICard({ roi, roiChange, isLoading }: ROIKPICardProps) {
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 animate-pulse">
        <div className="h-3.5 w-12 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
        <div className="h-8 w-28 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
        <div className="h-3 w-24 bg-gray-100 dark:bg-gray-800 rounded" />
      </div>
    );
  }

  const { text, bg } = roiColors(roi);
  const changeLabel = roiChange != null
    ? `${roiChange > 0 ? '+' : ''}${roiChange.toFixed(1)}% vs prior period`
    : null;

  return (
    <div className={`border border-gray-200 dark:border-gray-700 rounded-xl p-4 ${bg}`}>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">ROI</p>
      {roi === null ? (
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-bold ${text}`}>N/A</span>
          <span
            title="No cost data available for this period"
            className="cursor-help text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded"
          >
            ?
          </span>
        </div>
      ) : (
        <p className={`text-2xl font-bold ${text}`}>
          {arrow(roi)} {roi.toFixed(2)}%
        </p>
      )}
      {changeLabel && (
        <p className={`text-xs mt-1 ${text}`}>{changeLabel}</p>
      )}
    </div>
  );
}
