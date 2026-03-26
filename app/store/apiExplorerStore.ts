'use client';

import { create } from 'zustand';
import { getAuth } from 'firebase/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NetworkId = 'exoclick' | 'rollerads' | 'zeydoo' | 'propush';

export interface NetworkExplorerState {
  cachedResponse: unknown;
  lastFetched: string | null;
  isLoadingCached: boolean;
  isFetchingFresh: boolean;
  error: string | null;
  isConfigured: boolean;
}

const RAW_RESPONSE_ENDPOINTS: Record<NetworkId, string> = {
  exoclick: '/api/networks/exoclick/raw-response',
  rollerads: '/api/networks/rollerads/raw-response',
  zeydoo: '/api/networks/zeydoo/raw-response',
  propush: '/api/networks/propush/raw-response',
};

const NETWORK_IDS: NetworkId[] = ['exoclick', 'rollerads', 'zeydoo', 'propush'];

function defaultNetworkState(): NetworkExplorerState {
  return { cachedResponse: null, lastFetched: null, isLoadingCached: false, isFetchingFresh: false, error: null, isConfigured: false };
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface ApiExplorerStore {
  networks: Record<NetworkId, NetworkExplorerState>;
  loadCachedResponse: (network: NetworkId) => Promise<void>;
  fetchFreshSample: (network: NetworkId) => Promise<void>;
  clearError: (network: NetworkId) => void;
  setConfigured: (network: NetworkId, value: boolean) => void;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAuth().currentUser?.getIdToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export const useApiExplorerStore = create<ApiExplorerStore>((set, get) => ({
  networks: Object.fromEntries(NETWORK_IDS.map(id => [id, defaultNetworkState()])) as Record<NetworkId, NetworkExplorerState>,

  loadCachedResponse: async (network: NetworkId) => {
    const state = get().networks[network];
    if (!state.isConfigured || state.isLoadingCached) return;

    set(s => ({ networks: { ...s.networks, [network]: { ...s.networks[network], isLoadingCached: true, error: null } } }));
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(RAW_RESPONSE_ENDPOINTS[network], { headers });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = await res.json();
      set(s => ({
        networks: {
          ...s.networks,
          [network]: { ...s.networks[network], cachedResponse: data, lastFetched: new Date().toISOString(), isLoadingCached: false, error: null },
        },
      }));
    } catch (err) {
      set(s => ({
        networks: {
          ...s.networks,
          [network]: { ...s.networks[network], isLoadingCached: false, error: err instanceof Error ? err.message : 'Failed to load cached response.' },
        },
      }));
    }
  },

  fetchFreshSample: async (network: NetworkId) => {
    set(s => ({ networks: { ...s.networks, [network]: { ...s.networks[network], isFetchingFresh: true, error: null } } }));
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/networks/config/test-connection', {
        method: 'POST',
        headers,
        body: JSON.stringify({ networkId: network }),
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = await res.json();
      set(s => ({
        networks: {
          ...s.networks,
          [network]: { ...s.networks[network], cachedResponse: data, lastFetched: new Date().toISOString(), isFetchingFresh: false, error: null },
        },
      }));
    } catch (err) {
      set(s => ({
        networks: {
          ...s.networks,
          [network]: { ...s.networks[network], isFetchingFresh: false, error: err instanceof Error ? err.message : 'Failed to fetch fresh sample.' },
        },
      }));
    }
  },

  clearError: (network: NetworkId) => {
    set(s => ({ networks: { ...s.networks, [network]: { ...s.networks[network], error: null } } }));
  },

  setConfigured: (network: NetworkId, value: boolean) => {
    set(s => ({ networks: { ...s.networks, [network]: { ...s.networks[network], isConfigured: value } } }));
  },
}));
