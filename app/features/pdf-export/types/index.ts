// Step 142: TypeScript types for PDF export

import type { Timestamp } from 'firebase-admin/firestore';

export const ALLOWED_SECTIONS = [
  'cover_page',
  'executive_summary',
  'daily_trend',
  'geo_breakdown',
  'exoclick',
  'rollerads',
  'zeydoo',
  'propush',
  'activity_log',
] as const;

export type PdfSection = typeof ALLOWED_SECTIONS[number];

export interface PdfExportRequest {
  dateFrom: string;
  dateTo: string;
  sections: PdfSection[];
  orientation: 'portrait' | 'landscape';
  paperSize: 'a4' | 'letter';
  filename?: string;
}

export interface PdfAdStatRecord {
  userId: string;
  date: string;
  networkId: 'exoclick' | 'rollerads' | 'zeydoo' | 'propush';
  country: string;
  revenue: number;
  cost: number;
  impressions: number;
  clicks: number;
  ctr?: number;
  cpm?: number;
  rawResponse?: Record<string, unknown>;
}

export interface PdfAuditLogRecord {
  userId: string;
  createdAt: Timestamp | string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, unknown>;
  status: 'success' | 'failure';
}

export interface ExportKpis {
  totalRevenue: number;
  totalCost: number;
  netProfit: number;
  roi: number | null;
}
