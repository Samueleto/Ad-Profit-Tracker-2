// Step 135: ROI formula utilities

import type { RoiIndicator, ColorCode } from '@/features/roi/types';

export function computeRoi(totalRevenue: number, totalCost: number): number | null {
  if (totalCost <= 0) return null;
  return ((totalRevenue - totalCost) / totalCost) * 100;
}

export function getColorCode(roi: number | null): ColorCode {
  if (roi === null) return 'amber';
  if (roi >= 0) return 'green';
  return 'red';
}

export function getRoiIndicator(roi: number | null): RoiIndicator {
  if (roi === null) return 'no_cost_data';
  if (roi > 0) return 'positive';
  if (roi < 0) return 'negative';
  return 'breakeven';
}
