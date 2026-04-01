// Step 125: TypeScript types for Propush integration

import type { Timestamp } from 'firebase-admin/firestore';

export interface PropushAdStatDocument {
  id: string;
  userId: string;
  networkId: string; // 'propush'
  date: string; // YYYY-MM-DD
  geo: string; // country code
  revenue: number;
  impressions?: number;
  clicks?: number;
  cost: null; // Propush doesn't provide cost
  rawResponse: Record<string, unknown>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PropushApiKeyDocument {
  id: string;
  userId: string;
  networkId: string;
  encryptedKey: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PropushNetworkConfigDocument {
  id: string;
  userId: string;
  networkId: string;
  isActive: boolean;
  syncSchedule: string;
  lastSyncedAt: Timestamp | null;
  lastSyncStatus: 'success' | 'failed' | 'pending' | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PropushAuditLogDocument {
  id: string;
  userId: string;
  networkId: string;
  action: string;
  status: 'success' | 'failed';
  dateFrom: string;
  dateTo: string;
  recordsUpserted?: number;
  errorMessage?: string;
  createdAt: Timestamp;
}

export interface PropushStatRow {
  geo: string;
  revenue: number;
  impressions?: number;
  clicks?: number;
  date?: string;
  [key: string]: unknown;
}

export interface PropushApiResponse {
  success: boolean;
  data: PropushStatRow[];
  total?: number;
  error?: string;
}

// Request/response shapes for endpoints
export interface PropushSyncRequest {
  dateFrom: string;
  dateTo: string;
}

export interface PropushSyncResponse {
  success: boolean;
  recordsUpserted: number;
  dateFrom: string;
  dateTo: string;
  networkId: string;
}

export interface PropushStatusResponse {
  networkId: string;
  isActive: boolean;
  lastSyncedAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError?: string | null;
}
