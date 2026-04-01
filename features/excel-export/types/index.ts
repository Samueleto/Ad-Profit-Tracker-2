// Step 141: TypeScript types for Excel export

import { z } from 'zod';
import { differenceInDays, parseISO, isValid } from 'date-fns';

export const EXPORT_SHEET_KEYS = [
  'summary',
  'daily_trend',
  'geo_breakdown',
  'exoclick',
  'rollerads',
  'zeydoo',
  'propush',
  'activity_log',
] as const;

export type ExportSheetKey = typeof EXPORT_SHEET_KEYS[number];

export interface ExcelExportRequest {
  dateFrom: string;
  dateTo: string;
  sheets: ExportSheetKey[];
  filename?: string;
  includeHeaders?: boolean;
}

export interface ExportPreviewResponse {
  dateFrom: string;
  dateTo: string;
  sheets: Partial<Record<ExportSheetKey, number>>;
  totalRows: number;
  hasData: boolean;
  cachedAt: string | null;
}

export interface ExportSheetColumnConfig {
  header: string;
  key: string;
  width: number;
}

export interface ExportSheetConfig {
  key: ExportSheetKey;
  label: string;
  columns: ExportSheetColumnConfig[];
}

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const filenameRegex = /^[a-zA-Z0-9_-]+$/;

export const ExcelExportRequestSchema = z.object({
  dateFrom: z.string().regex(dateRegex, 'dateFrom must be in YYYY-MM-DD format'),
  dateTo: z.string().regex(dateRegex, 'dateTo must be in YYYY-MM-DD format'),
  sheets: z
    .array(z.enum(EXPORT_SHEET_KEYS))
    .min(1, 'At least one sheet must be selected'),
  filename: z
    .string()
    .max(100, 'Filename cannot exceed 100 characters')
    .regex(filenameRegex, 'Filename can only contain alphanumeric characters, dashes, and underscores')
    .optional(),
  includeHeaders: z.boolean().optional().default(true),
}).refine(
  (data) => {
    const from = parseISO(data.dateFrom);
    const to = parseISO(data.dateTo);
    if (!isValid(from) || !isValid(to)) return false;
    return from <= to;
  },
  { message: 'dateFrom must be before or equal to dateTo' }
).refine(
  (data) => {
    const from = parseISO(data.dateFrom);
    const to = parseISO(data.dateTo);
    if (!isValid(from) || !isValid(to)) return true;
    return differenceInDays(to, from) <= 90;
  },
  { message: 'Date range cannot exceed 90 days' }
);
