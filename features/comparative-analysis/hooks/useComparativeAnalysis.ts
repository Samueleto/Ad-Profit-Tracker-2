'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAuth } from 'firebase/auth';
import { differenceInDays, parseISO } from 'date-fns';
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
  syncFailed: boolean;
  clearSyncFailed: () => void;
  sessionExpired: boolean;
  dateRangeExceeded: boolean;
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
  const [syncFailed, setSyncFailed] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [dateRangeExceeded, setDateRangeExceeded] = useState(false);
  const hasLoadedRef = useRef(false);

  const fetchComparisonData = useCallback(async () => {
    setLoadStatus('loading');
    setErrorCode(null);
    setDateRangeExceeded(false);

    // Client-side 90-day cap — catch before sending the request
    try {
      const days = differenceInDays(parseISO(dateTo), parseISO(dateFrom));
      if (days > 90) {
        setDateRangeExceeded(true);
        setLoadStatus('error');
        return;
      }
    } catch {
      // Unparseable dates — let the API validate
    }

    try {
      const token = await getToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      const url = `/api/networks/comparison?dateFrom=${dateFrom}&dateTo=${dateTo}&metric=${selectedMetric}`;
      let res = await fetch(url, { headers, cache: 'no-store' });

      // 401: try token refresh once
      if (res.status === 401) {
        let refreshedToken: string | null = null;
        try {
          refreshedToken = await getToken(true);
        } catch {
          setSessionExpired(true);
          setLoadStatus('error');
          setErrorCode(401);
          return;
        }
        const refreshedHeaders: Record<string, string> = refreshedToken ? { Authorization: `Bearer ${refreshedToken}` } : {};
        res = await fetch(url, { headers: refreshedHeaders, cache: 'no-store' });
        if (res.status === 401) {
          setSessionExpired(true);
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
  useEffect(() => {
    fetchComparisonData();
  }, [fetchComparisonData]);

  const syncAllNetworks = useCallback(async () => {
    setIsSyncing(true);
    setSyncFailed(false);
    try {
      const token = await getToken();
      const res = await fetch('/api/sync/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        setSyncFailed(true);
        return;
      }
      await fetchComparisonData();
    } catch {
      setSyncFailed(true);
    } finally {
      setIsSyncing(false);
    }
  }, [fetchComparisonData]);

  return {
    selectedMetric,
    setSelectedMetric,
    comparisonData,
    loadStatus,
    errorCode,
    isSyncing,
    syncFailed,
    clearSyncFailed: () => setSyncFailed(false),
    sessionExpired,
    dateRangeExceeded,
    fetchComparisonData,
    syncAllNetworks,
  };
}
