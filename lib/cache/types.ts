// Step 133: Cache-related types and validation

import { z } from 'zod';

export interface NetworkCacheConfig {
  serverCacheTTLSeconds: number;
  clientCacheStaleSeconds: number;
  clientCacheFocusRevalidate: boolean;
}

export interface NetworkConfigWithCache {
  serverCacheTTLSeconds?: number;
  clientCacheStaleSeconds?: number;
  clientCacheFocusRevalidate?: boolean;
}

export function getNetworkCacheConfig(config: NetworkConfigWithCache): NetworkCacheConfig {
  return {
    serverCacheTTLSeconds: config.serverCacheTTLSeconds ?? 3600,
    clientCacheStaleSeconds: config.clientCacheStaleSeconds ?? 60,
    clientCacheFocusRevalidate: config.clientCacheFocusRevalidate ?? true,
  };
}

export const CacheInvalidateRequestSchema = z.object({
  scope: z.enum(['all', 'network', 'endpoint']),
  keys: z.array(z.string()).optional(),
});

export type CacheInvalidateRequest = z.infer<typeof CacheInvalidateRequestSchema>;
