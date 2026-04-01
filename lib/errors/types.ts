// Step 129: TypeScript types for error handling

export type NetworkId = 'exoclick' | 'rollerads' | 'zeydoo' | 'propush';

export type ErrorCode =
  | 'NETWORK_TIMEOUT'
  | 'AUTH_FAILURE'
  | 'RATE_LIMITED'
  | 'PARSE_ERROR'
  | 'FIRESTORE_WRITE_FAILURE'
  | 'DECRYPTION_FAILURE';

export type ErrorCategory = 'transient' | 'auth' | 'data' | 'infrastructure';

export interface BackoffScheduleEntry {
  attempt: number;
  delayMs: number;
  jitterRangeMs: [number, number];
}

export interface NetworkRetryState {
  networkId: NetworkId;
  retryCount: number;
  maxRetries: number;
  lastErrorCode: ErrorCode | null;
  lastErrorAt: string | null;
  nextRetryAt: string | null;
  circuitBreakerOpen: boolean;
  circuitBreakerOpenedAt: string | null;
  consecutiveFailures: number;
}

export interface CircuitBreakerStatus {
  networkId: NetworkId;
  isOpen: boolean;
  openedAt: string | null;
  failureCount: number;
  threshold: number;
  resetAfterSeconds: number;
}

export interface ErrorLogEntry {
  id: string;
  networkId: NetworkId | null;
  errorCode: ErrorCode;
  category: ErrorCategory;
  isRetryable: boolean;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface RetryConfig {
  networkId: NetworkId;
  maxRetries: number;
  backoffSchedule: BackoffScheduleEntry[];
  circuitBreakerThreshold: number;
  circuitBreakerResetSeconds: number;
}
