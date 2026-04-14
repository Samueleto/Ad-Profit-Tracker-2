'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useDateRangeStore } from '@/store/dateRangeStore';
import { useROIMetrics, useROIBreakdown, useROIThresholds } from '../hooks/useROI';
import ROIIndicatorSection from './ROIIndicatorSection';
import ROIThresholdsPanel from './ROIThresholdsPanel';

export default function ConnectedROISection() {
  const router = useRouter();
  const { fromDate, toDate } = useDateRangeStore();
  const [showThresholds, setShowThresholds] = useState(false);

  const {
    roi,
    roiChange,
    totalRevenue,
    totalCost,
    isLoading: metricsLoading,
    errorType,
    refetch,
  } = useROIMetrics(fromDate, toDate);

  const {
    breakdown,
    isLoading: breakdownLoading,
    error: breakdownError,
  } = useROIBreakdown(fromDate, toDate, 'network');

  const {
    thresholds,
    isLoading: thresholdsLoading,
  } = useROIThresholds();

  // Handle 401 — show toast then redirect
  useEffect(() => {
    if (errorType === 'error_401') {
      toast.error('Session expired. Please sign in again.');
      router.push('/');
    }
  }, [errorType, router]);

  // Derive state
  const isLoading = metricsLoading || thresholdsLoading;
  const state = isLoading
    ? 'loading'
    : errorType === 'error_401'
    ? 'error_401'
    : errorType === 'error_403'
    ? 'error_403'
    : errorType
    ? 'error_500'
    : roi === null && totalRevenue === null
    ? 'empty'
    : 'success';

  // Map breakdown items to network contributions
  const networkContributions = breakdownLoading
    ? []
    : breakdown.map(item => ({
        networkId: item.key,
        networkName: item.label,
        revenue: item.revenue,
        roi: item.roi,
      }));

  return (
    <div className="space-y-3">
      <ROIIndicatorSection
        state={state}
        roi={roi}
        roiChange={roiChange}
        revenue={totalRevenue ?? 0}
        cost={totalCost ?? 0}
        networkContributions={networkContributions}
        breakdownError={!!breakdownError}
        onRetry={refetch}
        positiveThreshold={thresholds?.positiveThreshold}
        warningThreshold={thresholds?.warningThreshold}
        onConfigureThresholds={() => setShowThresholds(v => !v)}
      />

      {showThresholds && (
        <ROIThresholdsPanel onClose={() => setShowThresholds(false)} />
      )}
    </div>
  );
}
