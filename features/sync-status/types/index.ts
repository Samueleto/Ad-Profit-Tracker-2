// Step 131: TypeScript types for sync status monitoring

export type NetworkId = 'exoclick' | 'rollerads' | 'zeydoo' | 'propush';
export type OverallHealth = 'healthy' | 'degraded' | 'critical';
export type SyncPhase = 'idle' | 'fetching' | 'writing' | 'complete' | 'failed';

export interface NetworkSyncState {
  networkId: NetworkId;
  isActive: boolean;
  syncPhase: SyncPhase;
  lastSyncStatus: string;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  latestSyncedAt: string | null;
  latestDataDate: string | null;
  lastRowsFetched: number | null;
  lastLatencyMs: number | null;
  circuitBreakerOpen: boolean;
  circuitBreakerOpenedAt: string | null;
  lastErrorCode: string | null;
  retryCount: number;
  totalFailureCount: number;
  timeUntilNextScheduledSync: number | null;
}

export interface LiveStateResponse {
  overallHealth: OverallHealth;
  networks: NetworkSyncState[];
  polledAt: string;
}

export interface ActivityFeedEntry {
  id: string;
  networkId: string;
  status: 'success' | 'failure';
  eventLabel: 'Scheduled Sync' | 'Manual Sync' | 'Backfill' | 'Retry';
  rowsFetched: number | null;
  latencyMs: number | null;
  dateFrom: string | null;
  dateTo: string | null;
  createdAt: string;
}

export interface ActivityFeedResponse {
  feed: ActivityFeedEntry[];
  hasMore: boolean;
  nextCursor: string | null;
}

export interface SyncProgressUpdate {
  networkId: string;
  phase: 'fetching' | 'writing' | 'complete' | 'idle';
  rowsFetched?: number;
  totalRows?: number;
  errorMessage?: string;
}
