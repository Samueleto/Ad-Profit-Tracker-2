"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { getAuth } from "firebase/auth";
import { format, subDays, differenceInDays, differenceInMinutes } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DashboardStatus = "idle" | "loading" | "success" | "empty" | "error";

export type Preset = "7d" | "14d" | "30d" | "month" | "custom";

export interface DateRange {
  dateFrom: string;
  dateTo: string;
  preset: Preset;
}

export interface Freshness {
  type: "live" | "cached";
  minutesAgo?: number;
}

export interface KPIs {
  totalRevenue: number | null;
  revenueChange: number | null;
  totalCost: number | null;
  costChange: number | null;
  netProfit: number | null;
  profitChange: number | null;
  roi: number | null;
  roiChange: number | null;
}

export interface DayEntry { date: string; revenue: number; cost: number; netProfit: number; roi: number }
export interface CountryRow { country: string; countryName?: string; revenue: number; cost: number; netProfit: number; metricShare: number }
export interface NetworkRow { networkId: string; primaryMetric: number; lastSyncAt?: string | null; syncStatus?: string }

export interface UseDashboardMetricsResult {
  status: DashboardStatus;
  errorStatus: number | null;
  kpis: KPIs | null;
  dailySeries: DayEntry[];
  topCountries: CountryRow[];
  perNetwork: NetworkRow[];
  freshness: Freshness;
  dateRange: DateRange;
  setDateRange: (preset: Preset, custom?: { dateFrom: string; dateTo: string }) => void;
  refresh: () => Promise<void>;
  dateRangeValidationError: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeDates(preset: Preset, custom?: { dateFrom: string; dateTo: string }): { dateFrom: string; dateTo: string } {
  const today = new Date();
  const fmt = (d: Date) => format(d, "yyyy-MM-dd");
  if (preset === "7d") return { dateFrom: fmt(subDays(today, 6)), dateTo: fmt(today) };
  if (preset === "14d") return { dateFrom: fmt(subDays(today, 13)), dateTo: fmt(today) };
  if (preset === "30d") return { dateFrom: fmt(subDays(today, 29)), dateTo: fmt(today) };
  if (preset === "month") return { dateFrom: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), dateTo: fmt(today) };
  if (preset === "custom" && custom) return { dateFrom: custom.dateFrom, dateTo: custom.dateTo };
  return { dateFrom: fmt(subDays(today, 6)), dateTo: fmt(today) };
}

async function fetchWithToken(url: string, signal: AbortSignal, forceRefresh = false): Promise<Response> {
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken(forceRefresh);
  return fetch(url, {
    signal,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDashboardMetrics(): UseDashboardMetricsResult {
  const initial = computeDates("7d");
  const [dateRange, setDateRangeState] = useState<DateRange>({ ...initial, preset: "7d" });
  const [status, setStatus] = useState<DashboardStatus>("idle");
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [dailySeries, setDailySeries] = useState<DayEntry[]>([]);
  const [topCountries, setTopCountries] = useState<CountryRow[]>([]);
  const [perNetwork, setPerNetwork] = useState<NetworkRow[]>([]);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [dateRangeValidationError, setDateRangeValidationError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const doFetch = useCallback(async (range: DateRange) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;
    setStatus("loading");
    setErrorStatus(null);
    try {
      const params = new URLSearchParams({ dateFrom: range.dateFrom, dateTo: range.dateTo });
      let res = await fetchWithToken(`/api/dashboard/metrics?${params}`, signal);
      if (res.status === 401) {
        res = await fetchWithToken(`/api/dashboard/metrics?${params}`, signal, true);
      }
      if (signal.aborted) return;
      if (!res.ok) {
        setStatus("error");
        setErrorStatus(res.status);
        return;
      }
      const data = await res.json();
      if (signal.aborted) return;
      const isEmpty = !data.dailySeries?.length && !data.topCountries?.length;
      setKpis(data.kpis ?? null);
      setDailySeries(data.dailySeries ?? []);
      setTopCountries(data.topCountries ?? []);
      setPerNetwork(data.perNetwork ?? []);
      setCachedAt(data.cachedAt ?? null);
      setStatus(isEmpty ? "empty" : "success");
    } catch (err) {
      if (signal.aborted) return;
      if (err instanceof Error && err.name === "AbortError") return;
      setStatus("error");
    }
  }, []);

  // Fetch whenever dateRange changes
  const dateRangeRef = useRef(dateRange);
  dateRangeRef.current = dateRange;
  useEffect(() => {
    doFetch(dateRange);
    return () => { abortRef.current?.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange.dateFrom, dateRange.dateTo, fetchTrigger]);

  const setDateRange = useCallback((preset: Preset, custom?: { dateFrom: string; dateTo: string }) => {
    if (preset === "custom" && custom) {
      const diff = differenceInDays(new Date(custom.dateTo), new Date(custom.dateFrom));
      if (diff > 90) {
        setDateRangeValidationError("Date range cannot exceed 90 days.");
        return;
      }
    }
    setDateRangeValidationError(null);
    const dates = computeDates(preset, custom);
    setDateRangeState({ ...dates, preset });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      await fetch("/api/cache/invalidate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    } catch { /* ignore invalidate errors */ }
    setFetchTrigger(n => n + 1);
  }, []);

  const freshness = useMemo<Freshness>(() => {
    if (!cachedAt) return { type: "live" };
    const minutesAgo = differenceInMinutes(new Date(), new Date(cachedAt));
    return { type: "cached", minutesAgo };
  }, [cachedAt]);

  return {
    status,
    errorStatus,
    kpis,
    dailySeries,
    topCountries,
    perNetwork,
    freshness,
    dateRange,
    setDateRange,
    refresh,
    dateRangeValidationError,
  };
}
