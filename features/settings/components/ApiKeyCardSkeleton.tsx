'use client';

export default function ApiKeyCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          {/* Network name */}
          <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
          {/* Updated at */}
          <div className="h-3 w-32 bg-gray-100 dark:bg-gray-800 rounded" />
        </div>
        <div className="flex items-center gap-2">
          {/* Badge */}
          <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
          {/* Button */}
          <div className="h-6 w-20 bg-gray-100 dark:bg-gray-800 rounded" />
        </div>
      </div>
    </div>
  );
}
