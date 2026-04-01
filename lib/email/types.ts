// Step 146: TypeScript types for email alerts

export const NOTIFICATION_TYPES = [
  'sync_failure',
  'sync_success',
  'export_complete',
  'export_failure',
  'schedule_delivered',
  'schedule_failed',
  'reconciliation_anomaly',
  'circuit_breaker_opened',
  'rate_limit_exceeded',
] as const;

export type NotificationType = typeof NOTIFICATION_TYPES[number];

export type Severity = 'info' | 'success' | 'warning' | 'error';

export interface NotificationTypeConfig {
  type: NotificationType;
  label: string;
  description: string;
  severity: Severity;
  isCritical: boolean;
}

export const NOTIFICATION_TYPE_CONFIGS: Record<NotificationType, NotificationTypeConfig> = {
  sync_failure: {
    type: 'sync_failure',
    label: 'Sync Failure',
    description: 'Sent when a network sync fails after all retries',
    severity: 'error',
    isCritical: true,
  },
  sync_success: {
    type: 'sync_success',
    label: 'Sync Success',
    description: 'Sent when a network sync completes successfully',
    severity: 'success',
    isCritical: false,
  },
  export_complete: {
    type: 'export_complete',
    label: 'Export Complete',
    description: 'Sent when a data export finishes',
    severity: 'info',
    isCritical: false,
  },
  export_failure: {
    type: 'export_failure',
    label: 'Export Failure',
    description: 'Sent when a data export fails',
    severity: 'error',
    isCritical: false,
  },
  schedule_delivered: {
    type: 'schedule_delivered',
    label: 'Schedule Delivered',
    description: 'Sent when a scheduled report is delivered',
    severity: 'success',
    isCritical: false,
  },
  schedule_failed: {
    type: 'schedule_failed',
    label: 'Schedule Failed',
    description: 'Sent when a scheduled report delivery fails',
    severity: 'warning',
    isCritical: false,
  },
  reconciliation_anomaly: {
    type: 'reconciliation_anomaly',
    label: 'Reconciliation Anomaly',
    description: 'Sent when a data reconciliation anomaly is detected',
    severity: 'warning',
    isCritical: true,
  },
  circuit_breaker_opened: {
    type: 'circuit_breaker_opened',
    label: 'Circuit Breaker Opened',
    description: 'Sent when a network circuit breaker opens due to repeated failures',
    severity: 'error',
    isCritical: true,
  },
  rate_limit_exceeded: {
    type: 'rate_limit_exceeded',
    label: 'Rate Limit Exceeded',
    description: 'Sent when an API rate limit is exceeded',
    severity: 'warning',
    isCritical: false,
  },
};

export interface NotificationPreference {
  type: NotificationType;
  enabled: boolean;
  emailEnabled: boolean;
  isDefault: boolean;
}

export interface NotificationPreferencesResponse {
  preferences: NotificationPreference[];
  alertDeliveryEmail: string | null;
  lastTestEmailSentAt: string | null;
}

export interface PatchPreferencesRequest {
  preferences?: Partial<Record<NotificationType, { enabled?: boolean; emailEnabled?: boolean }>>;
  alertDeliveryEmail?: string;
}

export interface EmailAuditLog {
  id: string;
  emailType: NotificationType;
  recipientEmail: string;
  subject: string;
  status: 'sent' | 'failed' | 'bounced';
  sentAt: string;
  triggeredBy: string;
}

export type SummaryType = 'daily' | 'weekly' | 'monthly';

export interface SendSummaryRequest {
  type: SummaryType;
  recipientEmail?: string;
}
