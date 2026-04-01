// Step 126: TypeScript types for sync data models

import type { Timestamp } from 'firebase-admin/firestore';

export type SupportedNetworkId = 'exoclick' | 'rollerads' | 'zeydoo' | 'propush';

export interface SyncNetworkConfig {
  userId: string;
  networkId: SupportedNetworkId;
  isActive: boolean;
  syncSchedule: string;
  lastSyncedAt: Timestamp | null;
  lastSyncStatus: 'success' | 'failed' | 'partial' | 'never';
  lastSyncError: string | null;
  retryAttempts: number;
}

export interface AdStatRow {
  userId: string;
  networkId: string;
  date: string; // YYYY-MM-DD
  country: string;
  impressions: number;
  clicks: number;
  revenue: number;
  cost?: number | null;
  ctr?: number | null;
  cpm?: number | null;
  rawResponse?: Record<string, unknown>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SyncApiKey {
  userId: string;
  networkId: string;
  encryptedKey: string;
  createdAt: Timestamp;
}

export interface SyncAuditLog {
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  status: 'success' | 'failure';
  metadata: {
    scheduledSync: boolean;
    latencyMs: number;
    rowsFetched: number;
    date?: string;
    [key: string]: unknown;
  };
  createdAt: Timestamp;
}

export interface SyncResult {
  networkId: SupportedNetworkId;
  success: boolean;
  rowsSynced: number;
  latencyMs: number;
  error?: string;
}

export interface ManualSyncRequest {
  networkId: SupportedNetworkId;
  dateFrom: string;
  dateTo: string;
}

export interface ManualSyncResponse {
  success: boolean;
  networkId: string;
  rowsSynced: number;
  latencyMs: number;
  error?: string;
}
