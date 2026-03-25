// Step 144: Schedule date computation utilities

import { format, addDays, subDays, startOfMonth } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import type { ScheduleDatePreset, ScheduleFrequency } from '@/features/scheduled-reports/types';

function formatDate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function computeNextRunAt(
  frequency: ScheduleFrequency,
  deliveryHour: number,
  timezone: string,
  dayOfWeek?: number | null,
  dayOfMonth?: number | null
): Date {
  const now = new Date();
  const zonedNow = toZonedTime(now, timezone);

  if (frequency === 'daily') {
    const todayZoned = new Date(
      zonedNow.getFullYear(),
      zonedNow.getMonth(),
      zonedNow.getDate(),
      deliveryHour,
      0,
      0
    );
    const todayUTC = fromZonedTime(todayZoned, timezone);
    if (todayUTC > now) return todayUTC;
    // Use tomorrow
    const tomorrowZoned = new Date(
      zonedNow.getFullYear(),
      zonedNow.getMonth(),
      zonedNow.getDate() + 1,
      deliveryHour,
      0,
      0
    );
    return fromZonedTime(tomorrowZoned, timezone);
  }

  if (frequency === 'weekly' && dayOfWeek != null) {
    const currentDay = zonedNow.getDay();
    let daysUntil = (dayOfWeek - currentDay + 7) % 7;
    if (daysUntil === 0) {
      // Check if today's run time has passed
      const todayCandidate = new Date(
        zonedNow.getFullYear(),
        zonedNow.getMonth(),
        zonedNow.getDate(),
        deliveryHour,
        0,
        0
      );
      const candidateUTC = fromZonedTime(todayCandidate, timezone);
      if (candidateUTC > now) return candidateUTC;
      daysUntil = 7;
    }
    const targetZoned = new Date(
      zonedNow.getFullYear(),
      zonedNow.getMonth(),
      zonedNow.getDate() + daysUntil,
      deliveryHour,
      0,
      0
    );
    return fromZonedTime(targetZoned, timezone);
  }

  if (frequency === 'monthly' && dayOfMonth != null) {
    const lastDayThisMonth = new Date(zonedNow.getFullYear(), zonedNow.getMonth() + 1, 0).getDate();
    const effectiveDayThisMonth = Math.min(dayOfMonth, lastDayThisMonth);

    const thisMonthCandidate = new Date(
      zonedNow.getFullYear(),
      zonedNow.getMonth(),
      effectiveDayThisMonth,
      deliveryHour,
      0,
      0
    );
    const candidateUTC = fromZonedTime(thisMonthCandidate, timezone);
    if (candidateUTC > now) return candidateUTC;

    // Use next month
    const nextMonth = new Date(zonedNow.getFullYear(), zonedNow.getMonth() + 1, 1);
    const lastDayNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
    const effectiveDayNextMonth = Math.min(dayOfMonth, lastDayNextMonth);

    const nextMonthCandidate = new Date(
      nextMonth.getFullYear(),
      nextMonth.getMonth(),
      effectiveDayNextMonth,
      deliveryHour,
      0,
      0
    );
    return fromZonedTime(nextMonthCandidate, timezone);
  }

  // Fallback: next day
  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}

export interface DateRangeResult {
  dateFrom: string;
  dateTo: string;
}

export function resolveDateRangePreset(preset: ScheduleDatePreset, timezone: string): DateRangeResult {
  const now = toZonedTime(new Date(), timezone);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = subDays(today, 1);

  switch (preset) {
    case 'yesterday':
      return { dateFrom: formatDate(yesterday), dateTo: formatDate(yesterday) };
    case 'last_7':
      return { dateFrom: formatDate(subDays(yesterday, 6)), dateTo: formatDate(yesterday) };
    case 'last_30':
      return { dateFrom: formatDate(subDays(yesterday, 29)), dateTo: formatDate(yesterday) };
    case 'last_90':
      return { dateFrom: formatDate(subDays(yesterday, 89)), dateTo: formatDate(yesterday) };
    case 'this_month':
      return { dateFrom: formatDate(startOfMonth(today)), dateTo: formatDate(today) };
    default:
      return { dateFrom: formatDate(subDays(yesterday, 29)), dateTo: formatDate(yesterday) };
  }
}
