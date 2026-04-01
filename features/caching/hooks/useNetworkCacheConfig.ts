'use client';

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/firestore';
import useSWR, { SWRConfiguration } from 'swr';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NetworkCacheConfig {
  clientCacheStaleSeconds: number;
  clientCacheFocusRevalidate: boolean;
  serverCacheTTLSeconds: number;
}

const DEFAULTS: NetworkCacheConfig = {
  clientCacheStaleSeconds: 60,
  clientCacheFocusRevalidate: true,
  serverCacheTTLSeconds: 3600,
};

// ─── formatTTL ────────────────────────────────────────────────────────────────

export function formatTTL(seconds: number): string {
  if (seconds <= 0) return '0 seconds';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} ${h === 1 ? 'hour' : 'hours'}`);
  if (m > 0) parts.push(`${m} ${m === 1 ? 'minute' : 'minutes'}`);
  if (s > 0) parts.push(`${s} ${s === 1 ? 'second' : 'seconds'}`);
  return parts.join(' ');
}

// ─── useNetworkCacheConfig ────────────────────────────────────────────────────

export function useNetworkCacheConfig(networkId: string): NetworkCacheConfig {
  const [config, setConfig] = useState<NetworkCacheConfig>(DEFAULTS);

  useEffect(() => {
    if (!networkId) return;
    const ref = doc(db, 'networkConfigs', networkId);
    const unsub = onSnapshot(
      ref,
      snap => {
        if (!snap.exists()) { setConfig(DEFAULTS); return; }
        const data = snap.data();
        setConfig({
          clientCacheStaleSeconds: typeof data.clientCacheStaleSeconds === 'number' && data.clientCacheStaleSeconds > 0
            ? data.clientCacheStaleSeconds
            : DEFAULTS.clientCacheStaleSeconds,
          clientCacheFocusRevalidate: typeof data.clientCacheFocusRevalidate === 'boolean'
            ? data.clientCacheFocusRevalidate
            : DEFAULTS.clientCacheFocusRevalidate,
          serverCacheTTLSeconds: typeof data.serverCacheTTLSeconds === 'number' && data.serverCacheTTLSeconds > 0
            ? data.serverCacheTTLSeconds
            : DEFAULTS.serverCacheTTLSeconds,
        });
      },
      () => { setConfig(DEFAULTS); } // on error, fall back to defaults
    );
    return unsub;
  }, [networkId]);

  return config;
}

// ─── useCachedNetworkData ─────────────────────────────────────────────────────

export function useCachedNetworkData<T>(
  networkId: string,
  key: string | null,
  fetcher: (url: string) => Promise<T>,
  extraOptions?: SWRConfiguration<T>
) {
  const cacheConfig = useNetworkCacheConfig(networkId);
  const swrOptions: SWRConfiguration<T> = {
    dedupingInterval: cacheConfig.clientCacheStaleSeconds * 1000,
    revalidateOnFocus: cacheConfig.clientCacheFocusRevalidate,
    keepPreviousData: true,
    ...extraOptions,
  };
  return useSWR<T>(key, fetcher, swrOptions);
}
