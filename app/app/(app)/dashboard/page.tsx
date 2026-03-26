import ManualRefreshPanel from '@/features/manual-refresh/components/ManualRefreshPanel';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Financial Metrics Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          View your ad network profits, trends, and analytics.
        </p>
      </div>

      <div className="max-w-xs">
        <ManualRefreshPanel />
      </div>
    </div>
  );
}
