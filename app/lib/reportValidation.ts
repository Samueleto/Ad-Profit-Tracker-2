// Step 143: Report validation utility

import {
  ALLOWED_METRICS,
  ALLOWED_NETWORKS,
  ALLOWED_GROUPBY,
  ALLOWED_DATA_QUALITY,
  ALLOWED_DATE_PRESETS,
  type ReportConfig,
} from '@/features/report-builder/types';
import { differenceInDays, parseISO, isValid } from 'date-fns';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateReportConfig(config: Partial<ReportConfig>): ValidationResult {
  const errors: string[] = [];

  // Validate metrics
  if (!config.metrics || config.metrics.length === 0) {
    errors.push('At least one metric must be selected');
  } else {
    const invalidMetrics = config.metrics.filter(
      (m) => !(ALLOWED_METRICS as readonly string[]).includes(m)
    );
    if (invalidMetrics.length > 0) {
      errors.push(`Invalid metrics: ${invalidMetrics.join(', ')}`);
    }
  }

  // Validate networks
  if (config.networks && config.networks.length > 0) {
    const invalidNetworks = config.networks.filter(
      (n) => !(ALLOWED_NETWORKS as readonly string[]).includes(n)
    );
    if (invalidNetworks.length > 0) {
      errors.push(`Invalid networks: ${invalidNetworks.join(', ')}`);
    }
  }

  // Validate groupBy
  if (config.groupBy && !(ALLOWED_GROUPBY as readonly string[]).includes(config.groupBy)) {
    errors.push(`Invalid groupBy value: ${config.groupBy}`);
  }

  // Validate dataQuality
  if (config.dataQuality && !(ALLOWED_DATA_QUALITY as readonly string[]).includes(config.dataQuality)) {
    errors.push(`Invalid dataQuality value: ${config.dataQuality}`);
  }

  // Validate dateRangePreset
  if (config.dateRangePreset && !(ALLOWED_DATE_PRESETS as readonly string[]).includes(config.dateRangePreset)) {
    errors.push(`Invalid dateRangePreset value: ${config.dateRangePreset}`);
  }

  // Validate custom date range
  if (config.dateRangePreset === 'custom') {
    if (!config.dateFrom || !config.dateTo) {
      errors.push('dateFrom and dateTo are required when using custom date range');
    } else {
      const from = parseISO(config.dateFrom);
      const to = parseISO(config.dateTo);
      if (!isValid(from) || !isValid(to)) {
        errors.push('dateFrom and dateTo must be valid YYYY-MM-DD dates');
      } else if (from > to) {
        errors.push('dateFrom must be before or equal to dateTo');
      } else if (differenceInDays(to, from) > 90) {
        errors.push('Date range cannot exceed 90 days');
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
