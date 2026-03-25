// Step 132: In-memory sliding window rate limiter

import type { UserQuotaConfig } from './types';
import { USER_QUOTA_CONFIGS } from './userLimiterConfig';

const quotaMap = new Map<string, number[]>();

function getKey(uid: string, endpoint: string): string {
  return `${uid}:${endpoint}`;
}

function getConfig(endpoint: string): UserQuotaConfig | undefined {
  return USER_QUOTA_CONFIGS.find((c) => c.endpoint === endpoint);
}

export function getRemainingQuota(uid: string, endpoint: string): number {
  const config = getConfig(endpoint);
  if (!config) return 0;

  const key = getKey(uid, endpoint);
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;

  const timestamps = (quotaMap.get(key) ?? []).filter((ts) => now - ts < windowMs);
  quotaMap.set(key, timestamps);

  return Math.max(0, config.limit - timestamps.length);
}

export function consumeQuota(uid: string, endpoint: string): boolean {
  const config = getConfig(endpoint);
  if (!config) return false;

  const key = getKey(uid, endpoint);
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;

  const timestamps = (quotaMap.get(key) ?? []).filter((ts) => now - ts < windowMs);

  if (timestamps.length >= config.limit) {
    quotaMap.set(key, timestamps);
    return false;
  }

  timestamps.push(now);
  quotaMap.set(key, timestamps);
  return true;
}

export function clearQuota(uid: string, endpoint: string): void {
  const key = getKey(uid, endpoint);
  quotaMap.delete(key);
}
