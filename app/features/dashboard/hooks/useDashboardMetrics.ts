"use client";

import useSWR from "swr";
import { useCallback } from "react";
import { auth } from "@/lib/firebase/auth";
import { useDashboardStore } from "@/store/dashboardStore";
import { format, subDays, startOfMonth } from "date-fns";

async function fetchWithAuth(url: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  const token = await user.getIdToken();
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

function getDateRangeParams(
  dateRange: string,
  customDateRange: { startDate: string | null; endDate: string | null }
) {
  const today = new Date();
  const endDate = format(today, "yyyy-MM-dd");

  switch (dateRange) {
    case "last_7_days":
      return { startDate: format(subDays(today, 7), "yyyy-MM-dd"), endDate };
    case "last_14_days":
      return { startDate: format(subDays(today, 14), "yyyy-MM-dd"), endDate };
    case "last_30_days":
      return { startDate: format(subDays(today, 30), "yyyy-MM-dd"), endDate };
    case "this_month":
      return { startDate: format(startOfMonth(today), "yyyy-MM-dd"), endDate };
    case "custom":
      return {
        startDate: customDateRange.startDate || format(subDays(today, 7), "yyyy-MM-dd"),
        endDate: customDateRange.endDate || endDate,
      };
    default:
      return { startDate: format(subDays(today, 7), "yyyy-MM-dd"), endDate };
  }
}

export function useDashboardMetrics() {
  const { dateRange, customDateRange } = useDashboardStore();
  const { startDate, endDate } = getDateRangeParams(dateRange, customDateRange);

  const key = `/api/dashboard/metrics?startDate=${startDate}&endDate=${endDate}`;

  const { data, error, isLoading, mutate } = useSWR(key, fetchWithAuth, {
    refreshInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    revalidateOnFocus: false,
  });

  const refresh = useCallback(() => mutate(), [mutate]);

  return {
    metrics: data,
    error,
    isLoading,
    refresh,
    dateRange: { startDate, endDate },
  };
}
