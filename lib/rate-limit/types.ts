// Step 132: TypeScript types for rate limiting

import type { Timestamp } from 'firebase-admin/firestore';

export type NetworkId = 'exoclick' | 'rollerads' | 'zeydoo' | 'propush';
export const VALID_NETWORKS: NetworkId[] = ['exoclick', 'rollerads', 'zeydoo', 'propush'];

export type ResetScope = 'outbound' | 'user-quota' | 'both';
export const VALID_SCOPES: ResetScope[] = ['outbound', 'user-quota', 'both'];

export interface NetworkLimiterStatus {
  networkId: NetworkId;
  isThrottled: boolean;
  reservoir: number;
  reservoirMax: number;
  nextReservoirRefreshAt: string | null;
  running: number;
  queued: number;
  circuitBreakerOpen: boolean;
  retryCount: number;
}

export interface UserQuotaStatus {
  endpoint: string;
  limit: number;
  windowSeconds: number;
  remaining: number;
  resetAt: string;
}

export interface NetworkLimiterConfig {
  networkId: NetworkId;
  maxConcurrent: number;
  minTimeMs: number;
  reservoir: number;
  reservoirRefreshIntervalMs: number;
  reservoirRefreshAmount: number;
  description: string;
}

export interface UserQuotaConfig {
  endpoint: string;
  limit: number;
  windowSeconds: number;
  description: string;
}

export interface ViolationRecord {
  id: string;
  networkId: string | null;
  endpoint: string;
  limitType: 'outbound' | 'user-quota';
  limitValue: number;
  windowSeconds: number;
  retryAfterSeconds: number | null;
  createdAt: Timestamp;
}
