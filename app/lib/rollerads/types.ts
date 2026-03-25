// Step 123: TypeScript types for RollerAds data

import type { Timestamp } from 'firebase-admin/firestore';

export interface AdStatDocument {
  userId: string;
  networkId: string;
  date: string; // YYYY-MM-DD
  country: string | null;
  revenue: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number | null;
  cost: null; // Always null for RollerAds
  rawResponse: Record<string, unknown>;
  syncedAt: Timestamp;
}

export interface NetworkConfigDocument {
  userId: string;
  networkId: string;
  isActive: boolean;
  syncSchedule: 'daily' | 'manual' | string;
  endpointOverride: string | null;
  timeoutSeconds: number;
  lastSyncedAt: Timestamp | null;
  lastSyncStatus: 'success' | 'failed' | null;
  lastSyncError: string | null;
}

export interface ApiKeyDocument {
  userId: string;
  networkId: string;
  encryptedKey: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AuditLogDocument {
  userId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, unknown>;
  status: 'success' | 'failure';
  errorMessage: string | null;
  createdAt: Timestamp;
}

export interface RollerAdsStatRow {
  site_id: string;
  date: string;
  country: string;
  impressions: number;
  clicks: number;
  ctr: number;
  revenue: number;
  cpm: number;
  ecpm: number;
}

export interface RollerAdsFieldSchema {
  field: string;
  type: string;
  description: string;
}
