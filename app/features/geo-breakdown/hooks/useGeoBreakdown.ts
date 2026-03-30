'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import { differenceInDays, parseISO } from 'date-fns';
import type { GeoCountryRow, GeoBreakdownResponse, GeoRoiEnrichment } from '../types';

// ─── Token helper ─────────────────────────────────────────────────────────────

async function getToken(): Promise<string | null> {
  const auth = getAuth();
  return auth.currentUser?.getIdToken() ?? null;
}

async function authFetch(path: string, token: string | null): Promise<Response> {
  return fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: 'no-store',
  });
}

// ─── 90-day cap ───────────────────────────────────────────────────────────────

function capDateRange(fromDate: string, toDate: string): { fromDate: string; toDate: string } {
  try {
    const from = parseISO(fromDate);
    const to = parseISO(toDate);
    const days = differenceInDays(to, from);
    if (days <= 90) return { fromDate, toDate };
    // Cap: keep toDate, move fromDate forward so range = 90 days
    const cappedFrom = new Date(to);
    cappedFrom.setDate(cappedFrom.getDate() - 90);
    return { fromDate: cappedFrom.toISOString().slice(0, 10), toDate };
  } catch {
    return { fromDate, toDate };
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseGeoBreakdownResult {
  countries: GeoCountryRow[];
  loading: boolean;
  error: boolean;
  sessionExpired: boolean;
  accessDenied: boolean;
  refresh: () => void;
}

export function useGeoBreakdown(fromDate: string, toDate: string): UseGeoBreakdownResult {
  const [countries, setCountries] = useState<GeoCountryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    setAccessDenied(false);
    const { fromDate: from, toDate: to } = capDateRange(fromDate, toDate);

    try {
      let token = await getToken();

      // Parallel fetch: geo-breakdown + roi enrichment
      let [geoRes, roiRes] = await Promise.all([
        authFetch(`/api/stats/geo-breakdown?from=${from}&to=${to}`, token),
        authFetch(`/api/roi/breakdown?dimension=country&from=${from}&to=${to}`, token).catch(() => null),
      ]);

      // 401 — refresh token and retry once
      if (geoRes.status === 401) {
        try {
          const auth = getAuth();
          token = await (auth.currentUser?.getIdToken(true) ?? Promise.resolve(null));
        } catch {
          setSessionExpired(true);
          setCountries([]);
          return;
        }
        [geoRes, roiRes] = await Promise.all([
          authFetch(`/api/stats/geo-breakdown?from=${from}&to=${to}`, token),
          authFetch(`/api/roi/breakdown?dimension=country&from=${from}&to=${to}`, token).catch(() => null),
        ]);
        if (geoRes.status === 401) {
          setSessionExpired(true);
          setCountries([]);
          return;
        }
      }

      if (geoRes.status === 403) {
        setAccessDenied(true);
        setCountries([]);
        return;
      }

      if (!geoRes.ok) {
        setError(true);
        setCountries([]);
        return;
      }

      const geoData: GeoBreakdownResponse = await geoRes.json();
      let rows: GeoCountryRow[] = geoData.countries ?? [];

      // Merge colorCode from ROI enrichment (best-effort)
      if (roiRes?.ok) {
        const roiData = await roiRes.json();
        const enrichments: GeoRoiEnrichment[] = roiData?.countries ?? roiData?.enrichments ?? [];
        const enrichMap = new Map(enrichments.map(e => [e.countryCode, e.colorCode]));
        rows = rows.map(r => ({
          ...r,
          colorCode: enrichMap.get(r.countryCode) ?? r.colorCode ?? 'neutral',
        }));
      }

      setCountries(rows);
    } catch {
      setError(true);
      setCountries([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { countries, loading, error, sessionExpired, accessDenied, refresh: fetchData };
}
