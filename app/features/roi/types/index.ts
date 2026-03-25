// Step 135: TypeScript types for ROI payloads

export type RoiIndicator = 'positive' | 'negative' | 'breakeven' | 'no_cost_data';
export type ColorCode = 'green' | 'red' | 'amber';
export type RoiChangeDirection = 'up' | 'down' | 'flat' | null;
export type RoiDimension = 'network' | 'country' | 'daily';

export interface RoiSeriesItem {
  key: string;
  date?: string;
  revenue: number;
  cost: number;
  netProfit: number;
  roi: number | null;
  roiIndicator: RoiIndicator;
  colorCode: ColorCode;
}

export interface RoiComputeResponse {
  dateFrom: string;
  dateTo: string;
  roi: number | null;
  roiIndicator: RoiIndicator;
  colorCode: ColorCode;
  totalRevenue: number;
  totalCost: number;
  netProfit: number;
  roiChange: number | null;
  roiChangeDirection: RoiChangeDirection;
  groupBy: string;
  series?: RoiSeriesItem[];
  cachedAt: string | null;
}

export interface RoiBreakdownItem {
  key: string;
  label: string;
  revenue: number;
  cost: number;
  netProfit: number;
  roi: number | null;
  roiIndicator: RoiIndicator;
  colorCode: ColorCode;
  contributionPercent: number;
}

export interface RoiBreakdownSummary {
  totalRevenue: number;
  totalCost: number;
  netProfit: number;
  overallRoi: number | null;
}

export interface RoiBreakdownResponse {
  dateFrom: string;
  dateTo: string;
  dimension: RoiDimension;
  breakdown: RoiBreakdownItem[];
  summary: RoiBreakdownSummary;
}

export interface RoiThresholds {
  positiveThreshold: number;
  warningThreshold: number;
  criticalThreshold: number;
  targetRoi: number | null;
  alertOnNegative: boolean;
  alertOnTargetMiss: boolean;
}

export interface RoiThresholdsGetResponse extends RoiThresholds {
  usingDefaults: string[];
}

export interface RoiThresholdsPatchResponse extends RoiThresholds {
  updatedAt: string;
}
