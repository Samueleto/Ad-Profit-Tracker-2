'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAuthHeaders } from '@/lib/auth/getAuthHeaders';
import type { NetworkId, NetworkStatus } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NetworkStatusMap = Record<NetworkId, Omit<NetworkStatus, 'networkId'>>;

export interface UseApiKeyStatusResult {
  statusMap: NetworkStatusMap;
  loading: boolean;
  error: string | null;
  submitting: Set<NetworkId>;
  markConnected: (networkId: NetworkId, updatedAt: string) => void;
  markDisconnected: (networkId: NetworkId) => void;
  setSubmitting: (networkId: NetworkId) => void;
  clearSubmitting: (networkId: NetworkId) => void;
}

const DEFAULT_STATUS_MAP: NetworkStatusMap = {
  exoclick: { status: 'not_connected', updatedAt: null },
  rollerads: { status: 'not_connected', updatedAt: null },
  zeydoo: { status: 'not_connected', updatedAt: null },
  propush: { status: 'not_connected', updatedAt: null },
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useApiKeyStatus(): UseApiKeyStatusResult {
  const [statusMap, setStatusMap] = useState<NetworkStatusMap>({ ...DEFAULT_STATUS_MAP });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmittingSet] = useState<Set<NetworkId>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/keys/status', { headers });
        if (!res.ok) { setError('Failed to load API key status.'); return; }
        const data = await res.json();
        const statuses: NetworkStatus[] = data.statuses ?? data ?? [];
        const map: NetworkStatusMap = { ...DEFAULT_STATUS_MAP };
        for (const s of statuses) {
          if (s.networkId in map) {
            map[s.networkId] = { status: s.status, updatedAt: s.updatedAt };
          }
        }
        setStatusMap(map);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load API key status.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const markConnected = useCallback((networkId: NetworkId, updatedAt: string) => {
    setStatusMap(prev => ({
      ...prev,
      [networkId]: { status: 'connected', updatedAt },
    }));
  }, []);

  const markDisconnected = useCallback((networkId: NetworkId) => {
    setStatusMap(prev => ({
      ...prev,
      [networkId]: { status: 'not_connected', updatedAt: null },
    }));
  }, []);

  const setSubmitting = useCallback((networkId: NetworkId) => {
    setSubmittingSet(prev => new Set(prev).add(networkId));
  }, []);

  const clearSubmitting = useCallback((networkId: NetworkId) => {
    setSubmittingSet(prev => {
      const next = new Set(prev);
      next.delete(networkId);
      return next;
    });
  }, []);

  return { statusMap, loading, error, submitting, markConnected, markDisconnected, setSubmitting, clearSubmitting };
}
