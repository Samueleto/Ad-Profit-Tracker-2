'use client';

interface ROINetworkContributionRowProps {
  networkName: string;
  revenue: number | null;
  roi: number | null;
}

function roiColor(roi: number | null): string {
  if (roi === null) return 'text-amber-600 dark:text-amber-400';
  if (roi > 0) return 'text-green-600 dark:text-green-400';
  if (roi < 0) return 'text-red-500 dark:text-red-400';
  return 'text-amber-600 dark:text-amber-400';
}

export default function ROINetworkContributionRow({ networkName, revenue, roi }: ROINetworkContributionRowProps) {
  return (
    <div className="flex items-center gap-3 py-1.5 text-sm">
      <span className="flex-1 text-gray-700 dark:text-gray-300">{networkName}</span>
      <span className="text-gray-600 dark:text-gray-400">
        {revenue != null ? `$${revenue.toFixed(2)}` : '—'}
      </span>
      <span className={`font-semibold w-20 text-right ${roiColor(roi)}`}>
        {roi != null ? `${roi > 0 ? '↑' : roi < 0 ? '↓' : '→'} ${roi.toFixed(1)}%` : 'N/A'}
      </span>
    </div>
  );
}
