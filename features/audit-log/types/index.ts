// Step 121: AuditLog TypeScript types and validation

import type { Timestamp } from 'firebase/firestore';

export const AUDIT_ACTIONS = [
  'api_key_saved',
  'api_key_deleted',
  'network_config_updated',
  'network_config_reordered',
  'network_config_reset',
  'network_connection_tested',
  'manual_sync_triggered',
  'preferences_updated',
  'profile_updated',
  'account_deleted',
] as const;

export type AuditAction = typeof AUDIT_ACTIONS[number];

export const AUDIT_RESOURCE_TYPES = [
  'api_key',
  'network_config',
  'preferences',
  'profile',
  'sync',
] as const;

export type AuditResourceType = typeof AUDIT_RESOURCE_TYPES[number];

export interface AuditLog {
  id: string;
  userId: string;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  status: 'success' | 'failure';
  errorMessage: string | null;
  createdAt: Timestamp | string | number;
}

export interface LogFilters {
  action?: AuditAction[];
  resourceType?: AuditResourceType;
  startDate?: string;
  endDate?: string;
  status?: 'success' | 'failure';
  search?: string;
  limit?: number;
  cursor?: string;
}

export interface PaginatedLogsResponse {
  logs: AuditLog[];
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
}
