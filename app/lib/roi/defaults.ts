// Step 135: ROI threshold defaults

import type { RoiThresholds } from '@/features/roi/types';

export const ROI_THRESHOLD_DEFAULTS: RoiThresholds = {
  positiveThreshold: 0,
  warningThreshold: -10,
  criticalThreshold: -10,
  targetRoi: null,
  alertOnNegative: false,
  alertOnTargetMiss: false,
};
