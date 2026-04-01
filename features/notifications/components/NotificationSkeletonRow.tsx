export default function NotificationSkeletonRow() {
  return (
    <div className="flex items-start gap-3 px-4 py-3 h-14 animate-pulse border-l-4 border-gray-200 dark:border-gray-700">
      <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded-full mt-0.5 flex-shrink-0" />
      <div className="flex-1 space-y-1.5 min-w-0">
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
        <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded w-full" />
      </div>
      <div className="h-2.5 w-12 bg-gray-200 dark:bg-gray-700 rounded flex-shrink-0" />
    </div>
  );
}
