// Step 129: Error classification utilities

import type { ErrorCode, ErrorCategory } from './types';

export function isRetryable(errorCode: ErrorCode | null): boolean {
  if (!errorCode) return false;
  return ['NETWORK_TIMEOUT', 'RATE_LIMITED', 'PARSE_ERROR'].includes(errorCode);
}

export function getErrorCategory(errorCode: ErrorCode | null): ErrorCategory {
  if (!errorCode) return 'infrastructure';
  switch (errorCode) {
    case 'NETWORK_TIMEOUT':
    case 'RATE_LIMITED':
      return 'transient';
    case 'AUTH_FAILURE':
      return 'auth';
    case 'PARSE_ERROR':
      return 'data';
    case 'FIRESTORE_WRITE_FAILURE':
    case 'DECRYPTION_FAILURE':
      return 'infrastructure';
    default:
      return 'infrastructure';
  }
}
