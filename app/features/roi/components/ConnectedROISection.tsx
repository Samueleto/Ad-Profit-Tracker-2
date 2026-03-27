'use client';

import { useState } from 'react';
import { useDateRangeStore } from '@/store/dateRangeStore';
import { useROIMetrics, useROIBreakdown, useROIThresholds } from '../hooks/useROI';
import ROIIndicatorSection from './ROIIndicatorSection';
import ROIThresholdsPanel from './ROIThresholdsPanel';

export default function ConnectedROISection() {
  const { fromDate, toDate } = useDateRangeStore();
  const [showThresholds, setShowThresholds] = useState(false);

  const {
    roi,
    roiChange,
    totalRevenue,
    totalCost,
    isLoading: metricsLoading,
    error: metricsError,
    refetch,
  } = useROIMetrics(fromDate, toDate);

  const {
    breakdown,
    isLoading: breakdownLoading,
  } = useROIBreakdown(fromDate, toDate, 'network');

  const {
    thresholds,
    isLoading: thresholdsLoading,
  } = useROIThresholds();

  // Derive state
  const isLoading = metricsLoading || thresholdsLoading;
  const state = isLoading
    ? 'loading'
    : metricsError
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
