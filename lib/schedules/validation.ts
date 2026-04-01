// Step 144: Schedule field validation

import type { CreateScheduleInput } from '@/features/scheduled-reports/types';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_FREQUENCIES = ['daily', 'weekly', 'monthly'];
const VALID_DATE_PRESETS = ['yesterday', 'last_7', 'last_30', 'last_90', 'this_month'];
const VALID_FORMATS = ['excel', 'pdf'];

export function validateScheduleFields(input: Partial<CreateScheduleInput>): string[] {
  const errors: string[] = [];

  if (!input.frequency || !VALID_FREQUENCIES.includes(input.frequency)) {
    errors.push(`frequency must be one of: ${VALID_FREQUENCIES.join(', ')}`);
  }

  if (input.frequency === 'weekly') {
    if (input.dayOfWeek == null || input.dayOfWeek < 0 || input.dayOfWeek > 6) {
      errors.push('dayOfWeek must be 0-6 for weekly schedules');
    }
  }

  if (input.frequency === 'monthly') {
    if (input.dayOfMonth == null || input.dayOfMonth < 1 || input.dayOfMonth > 28) {
      errors.push('dayOfMonth must be 1-28 for monthly schedules');
    }
  }

  if (input.deliveryHour == null || input.deliveryHour < 0 || input.deliveryHour > 23) {
    errors.push('deliveryHour must be 0-23');
  }

  if (!input.timezone) {
    errors.push('timezone is required');
  } else {
    try {
      if (typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl) {
        const supported = (Intl as { supportedValuesOf: (key: string) => string[] }).supportedValuesOf('timeZone');
        if (!supported.includes(input.timezone)) {
          errors.push(`timezone '${input.timezone}' is not a valid IANA timezone`);
        }
      } else {
        Intl.DateTimeFormat(undefined, { timeZone: input.timezone });
      }
    } catch {
      errors.push(`timezone '${input.timezone}' is not a valid IANA timezone`);
    }
  }

  if (!input.deliveryEmail) {
    errors.push('deliveryEmail is required');
  } else if (!EMAIL_REGEX.test(input.deliveryEmail)) {
    errors.push('deliveryEmail is not a valid email address');
  }

  if (!input.dateRangePreset || !VALID_DATE_PRESETS.includes(input.dateRangePreset)) {
    errors.push(`dateRangePreset must be one of: ${VALID_DATE_PRESETS.join(', ')}`);
  }

  if (!input.format || !VALID_FORMATS.includes(input.format)) {
    errors.push(`format must be one of: ${VALID_FORMATS.join(', ')}`);
  }

  return errors;
}
