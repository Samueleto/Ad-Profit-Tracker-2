'use client';

export default function ChartLoadingSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded-md" />
          ))}
        </div>
        <div className="flex gap-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded-md" />
          ))}
        </div>
      </div>
      {/* Chart skeleton */}
      <div className="h-80 md:h-72 bg-gray-200 dark:bg-gray-700 rounded-lg" />
    </div>
  );
}
