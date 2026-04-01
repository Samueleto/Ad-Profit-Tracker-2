import { CheckCircle } from 'lucide-react';

export default function NotificationEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-3">
        <CheckCircle className="w-6 h-6 text-green-500" />
      </div>
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">You&apos;re all caught up</p>
      <p className="text-xs text-gray-400 mt-1">No notifications to show</p>
    </div>
  );
}
