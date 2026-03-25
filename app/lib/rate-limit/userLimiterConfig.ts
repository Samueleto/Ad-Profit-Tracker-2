// Step 132: User quota configuration

import type { UserQuotaConfig } from './types';

export const USER_QUOTA_CONFIGS: UserQuotaConfig[] = [
  {
    endpoint: '/api/sync/manual',
    limit: 10,
    windowSeconds: 3600,
    description: 'Manual sync trigger limit per hour',
  },
  {
    endpoint: '/api/stats/backfill',
    limit: 3,
    windowSeconds: 3600,
    description: 'Stats backfill limit per hour',
  },
  {
    endpoint: '/api/scheduled/retry-failed',
    limit: 5,
    windowSeconds: 3600,
    description: 'Retry failed sync limit per hour per network',
  },
  {
    endpoint: '/api/reconciliation/run',
    limit: 10,
    windowSeconds: 3600,
    description: 'Reconciliation run limit per hour',
  },
  {
    endpoint: '/api/errors/circuit-breaker/reset',
    limit: 10,
    windowSeconds: 3600,
    description: 'Circuit breaker reset limit per hour',
  },
];

export function getQuotaConfig(endpoint: string): UserQuotaConfig | undefined {
  return USER_QUOTA_CONFIGS.find((c) => c.endpoint === endpoint);
}
