// Step 145: TypeScript types for notifications

import type { Timestamp } from 'firebase-admin/firestore';

export const NOTIFICATION_TYPES = [
  'sync_success',
  'sync_failure',
  'export_complete',
  'export_failure',
  'schedule_delivered',
  'schedule_failed',
  'reconciliation_anomaly',
  'circuit_breaker_opened',
  'rate_limit_exceeded',
] as const;

export type NotificationType = typeof NOTIFICATION_TYPES[number];

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  networkId: string | null;
  resourceType: string;
  resourceId: string | null;
  isRead: boolean;
  isDismissed: boolean;
  severity: NotificationSeverity;
  actionUrl: string | null;
  metadata: Record<string, unknown>;
  createdAt: Timestamp | string;
}

export interface NotificationPreference {
  type: NotificationType;
  enabled: boolean;
  isDefault: boolean;
}

export interface GetNotificationsResponse {
  notifications: AppNotification[];
  unreadCount: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export interface DismissNotificationResponse {
  dismissed: boolean;
  notificationId: string;
  unreadCount: number;
}

export interface MarkAllReadResponse {
  success: boolean;
  updatedCount: number;
  unreadCount: number;
}

export interface ClearNotificationsResponse {
  success: boolean;
  clearedCount: number;
}

export interface CreateNotificationResponse {
  success: boolean;
  notificationId: string;
}

export interface PreferencesResponse {
  preferences: NotificationPreference[];
}

export interface UserNotificationFields {
  notifications: AppNotification[];
  unreadNotificationCount: number;
  notificationsUpdatedAt: Timestamp;
  notificationPreferences: Partial<Record<NotificationType, { enabled: boolean }>>;
}
