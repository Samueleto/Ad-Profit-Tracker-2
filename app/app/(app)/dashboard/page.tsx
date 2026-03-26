import ManualRefreshPanel from '@/features/manual-refresh/components/ManualRefreshPanel';
import SyncStatusPanel from '@/features/sync-status/components/SyncStatusPanel';

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <ManualRefreshPanel />
        </div>
        <div className="lg:col-span-2">
          <SyncStatusPanel />
        </div>
      </div>
    </div>
  );
}
