// Step 120: TypeScript interfaces for network configurations

import type { Timestamp } from 'firebase/firestore';

export type SyncSchedule = 'daily' | 'manual' | string;
export type LastSyncStatus = 'success' | 'failed' | 'partial' | 'never' | null;

export interface NetworkConfig {
  userId: string;
  networkId: string;
  isActive: boolean;
  syncSchedule: SyncSchedule;
  dataRole: 'cost' | 'revenue';
  endpointOverride: string | null;
  timeoutSeconds: number;
  retryAttempts: number;
  lastSyncedAt: Timestamp | null;
  lastSyncStatus: LastSyncStatus;
  lastSyncError: string | null;
  displayOrder: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface NetworkConfigUpdate {
  isActive?: boolean;
  syncSchedule?: SyncSchedule;
  endpointOverride?: string | null;
  timeoutSeconds?: number;
  retryAttempts?: number;
  displayOrder?: number;
}
