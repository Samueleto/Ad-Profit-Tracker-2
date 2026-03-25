// Step 144: TypeScript types for scheduled reports

import type { Timestamp } from 'firebase-admin/firestore';

export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly';
export type ScheduleFormat = 'excel' | 'pdf';
export type ScheduleDatePreset = 'yesterday' | 'last_7' | 'last_30' | 'last_90' | 'this_month';
export type ScheduleRunStatus = 'success' | 'failure' | null;

export interface ScheduledReport {
  id: string;
  reportId: string;
  reportName: string;
  frequency: ScheduleFrequency;
  dayOfWeek: number | null; // 0=Sun, 6=Sat
  dayOfMonth: number | null; // 1-28
  deliveryHour: number; // 0-23
  timezone: string;
  deliveryEmail: string;
  dateRangePreset: ScheduleDatePreset;
  format: ScheduleFormat;
  isActive: boolean;
  lastRunAt: Timestamp | null;
  lastRunStatus: ScheduleRunStatus;
  lastRunError: string | null;
  nextRunAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type CreateScheduleInput = {
  reportId: string;
  reportName: string;
  frequency: ScheduleFrequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
  deliveryHour: number;
  timezone: string;
  deliveryEmail: string;
  dateRangePreset: ScheduleDatePreset;
  format: ScheduleFormat;
  isActive?: boolean;
};

export type UpdateScheduleInput = Partial<Omit<CreateScheduleInput, 'reportId'>>;
