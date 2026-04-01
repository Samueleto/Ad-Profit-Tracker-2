import type { Metadata } from 'next';
import { Suspense } from 'react';
import ReconciliationDashboard from '@/features/reconciliation/components/ReconciliationDashboard';

export const metadata: Metadata = {
  title: 'Reconciliation | Ad Profit Tracker',
  description: 'Validate ad network data, detect anomalies, and manage reconciliation rules.',
};

export default function ReconciliationPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          Data Reconciliation
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          Validate your ad network data, detect anomalies, and manage validation rules.
        </p>
      </div>
      <Suspense>
        <ReconciliationDashboard />
      </Suspense>
    </div>
  );
}
