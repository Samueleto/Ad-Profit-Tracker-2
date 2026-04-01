// Step 129: Backoff schedule utility

import type { BackoffScheduleEntry } from './types';

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;
const JITTER_FACTOR = 0.2;

export function computeBackoffSchedule(retryAttempts: number): BackoffScheduleEntry[] {
  const schedule: BackoffScheduleEntry[] = [];
  for (let attempt = 1; attempt <= retryAttempts; attempt++) {
    const rawDelay = Math.min(BASE_DELAY_MS * Math.pow(2, attempt - 1), MAX_DELAY_MS);
    const jitter = Math.floor(rawDelay * JITTER_FACTOR);
    schedule.push({
      attempt,
      delayMs: rawDelay,
      jitterRangeMs: [rawDelay - jitter, rawDelay + jitter],
    });
  }
  return schedule;
}
