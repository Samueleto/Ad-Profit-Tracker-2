// Steps 126-127: TypeScript types for sync data models

import type { Timestamp } from 'firebase-admin/firestore';

export type NetworkId = 'exoclick' | 'rollerads' | 'zeydoo' | 'propush';
export type SyncStatus = 'success' | 'failed' | 'never' | 'in_progress';

export interface NetworkSyncState {
  networkId: NetworkId;
  lastSyncedAt: Date | null;
  lastSyncStatus: SyncStatus;
  lastSyncError: string | null;
}

export interface ManualSyncRequest {
  networkId?: NetworkId;
  dateFrom?: string;
  dateTo?: string;
}

export interface ManualSyncResult {
  networkId: NetworkId;
  status: 'success' | 'failed' | 'skipped';
  rowsFetched: number | null;
  latencyMs: number | null;
  errorMessage: string | null;
}

export interface ManualSyncResponse {
  triggered: string[];
  skipped: string[];
  failed: string[];
  results: ManualSyncResult[];
  triggeredAt: string;
}

export interface SyncHistoryEntry {
  networkId: NetworkId;
  status: SyncStatus;
  rowsFetched: number | null;
  latencyMs: number | null;
  triggeredAt: string;
  triggeredBy: 'user' | 'scheduler';
}

export interface SyncNetworkConfig {
  networkId: NetworkId;
  isActive: boolean;
  lastSyncedAt: Date | null;
  lastSyncStatus: SyncStatus;
  lastSyncError: string | null;
  retryAttempts: number;
}
