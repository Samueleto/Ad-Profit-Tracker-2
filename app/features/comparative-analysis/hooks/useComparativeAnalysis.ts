'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAuth } from 'firebase/auth';
import type { ComparisonMetric, ComparisonResponse } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error' | 'empty';

export interface UseComparativeAnalysisResult {
  selectedMetric: ComparisonMetric;
  setSelectedMetric: (m: ComparisonMetric) => void;
  comparisonData: ComparisonResponse | null;
  loadStatus: LoadStatus;
  errorCode: number | null;
  isSyncing: boolean;
  fetchComparisonData: () => Promise<void>;
  syncAllNetworks: () => Promise<void>;
}

// ─── Token helper ─────────────────────────────────────────────────────────────

async function getToken(forceRefresh = false): Promise<string | null> {
  const auth = getAuth();
  return auth.currentUser?.getIdToken(forceRefresh) ?? null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useComparativeAnalysis(
  dateFrom: string,
  dateTo: string
): UseComparativeAnalysisResult {
  const [selectedMetric, setSelectedMetric] = useState<ComparisonMetric>('roi');
  const [comparisonData, setComparisonData] = useState<ComparisonResponse | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('idle');
  const [errorCode, setErrorCode] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const hasLoadedRef = useRef(false);

  const fetchComparisonData = useCallback(async () => {
    setLoadStatus('loading');
    setErrorCode(null);

    try {
      const token = await getToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      const url = `/api/networks/comparison?from=${dateFrom}&to=${dateTo}&metric=${selectedMetric}`;
      let res = await fetch(url, { headers, cache: 'no-store' });

      // 401: try token refresh once
      if (res.status === 401) {
        const refreshedToken = await getToken(true);
        const refreshedHeaders: Record<string, string> = refreshedToken ? { Authorization: `Bearer ${refreshedToken}` } : {};
        res = await fetch(url, { headers: refreshedHeaders, cache: 'no-store' });
        if (res.status === 401) {
          setLoadStatus('error');
          setErrorCode(401);
          return;
        }
      }

      if (res.status === 404) {
        setLoadStatus('empty');
        setComparisonData(null);
        return;
      }

      if (res.status === 403) {
        setLoadStatus('error');
        setErrorCode(403);
        return;
      }

      if (!res.ok) {
        setLoadStatus('error');
        setErrorCode(res.status);
        return;
      }

      const json: ComparisonResponse = await res.json();
      if (!json.networks || json.networks.length === 0) {
        setLoadStatus('empty');
        setComparisonData(null);
        return;
      }

      setComparisonData(json);
      setLoadStatus('success');
      hasLoadedRef.current = true;
    } catch {
      setLoadStatus('error');
      setErrorCode(500);
    }
  }, [dateFrom, dateTo, selectedMetric]);

  // Re-fetch when dateFrom, dateTo, or selectedMetric changes
  // But only after first activation (lazy loading via hasLoaded)
  useEffect(() => {
    // First render: fetch immediately (activating the tab triggers this)
    // Subsequent changes: re-fetch
    fetchComparisonData();
  }, [fetchComparisonData]);

  const syncAllNetworks = useCallback(async () => {
    setIsSyncing(true);
    try {
      const token = await getToken();
      await fetch('/api/sync/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({}),
      });
    } finally {
      setIsSyncing(false);
      await fetchComparisonData();
    }
  }, [fetchComparisonData]);

  return {
    selectedMetric,
    setSelectedMetric,
    comparisonData,
    loadStatus,
    errorCode,
    isSyncing,
    fetchComparisonData,
    syncAllNetworks,
  };
}
