'use client';

export default function PreferencesSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 animate-pulse">
      <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
      <hr className="border-gray-200 dark:border-gray-700 mb-5" />
      <div className="space-y-5">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-3.5 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-9 w-full bg-gray-100 dark:bg-gray-800 rounded-lg" />
          </div>
        ))}
        <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>
    </div>
  );
}
