'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2, ShieldAlert } from 'lucide-react';
import { useDateRangeStore } from '@/store/dateRangeStore';
import { auth } from '@/lib/firebase/auth';
import { toast } from 'sonner';

export default function DataAvailabilityDot() {
  const router = useRouter();
  const { fromDate, toDate, dataAvailability, setDataAvailability } = useDateRangeStore();
  const [sessionExpired, setSessionExpired] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    if (sessionExpired) {
      toast.error('Session expired. Please sign in again.');
      router.replace('/');
    }
  }, [sessionExpired, router]);

  useEffect(() => {
    let cancelled = false;
    setAccessDenied(false);

    const fetchAvailability = async (retry = false) => {
      setDataAvailability('loading');
      try {
        const user = auth.currentUser;
        if (!user) {
          setDataAvailability('none');
          return;
        }
        const token = await user.getIdToken(retry);
        const res = await fetch(`/api/stats/dates?dateFrom=${fromDate}&dateTo=${toDate}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (cancelled) return;

        if (res.status === 401) {
          if (!retry) return fetchAvailability(true);
          // Retry also returned 401 — session truly expired
          setSessionExpired(true);
          setDataAvailability('error');
          return;
        }
        if (res.status === 403) {
          setAccessDenied(true);
          setDataAvailability('error');
          if (process.env.NODE_ENV === 'development') {
            console.warn('[DataAvailabilityDot] 403 Access Denied on /api/stats/dates — check auth/RBAC config');
          }
          return;
        }
        if (res.status === 404 || res.status === 204) {
          setDataAvailability('none');
          return;
        }
        if (res.status >= 500) {
          setDataAvailability('error');
          return;
        }

        const data = await res.json();
        setDataAvailability(data.availability ?? 'none');
      } catch {
        if (!cancelled) setDataAvailability('error');
      }
    };

    // Debounce: wait 300ms before firing so rapid preset switches don't fire multiple requests
    const timer = setTimeout(() => fetchAvailability(), 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [fromDate, toDate, setDataAvailability]);

  if (sessionExpired) return null;

  if (accessDenied) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400" title="Access denied">
        <ShieldAlert className="h-3 w-3" />
        <span className="hidden sm:inline">Access Denied</span>
      </span>
    );
  }

  if (dataAvailability === 'loading') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-gray-500" title="Checking data availability">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span className="sr-only">Loading</span>
      </span>
    );
  }

  if (dataAvailability === 'complete') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-green-600" title="Data complete">
        <span className="inline-block h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
        <span className="sr-only">Data complete</span>
      </span>
    );
  }

  if (dataAvailability === 'partial') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-amber-600" title="Partial data">
        <span className="inline-block h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
        <span className="sr-only">Partial data</span>
      </span>
    );
  }

  if (dataAvailability === 'error') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-amber-600" title="Data error">
        <AlertTriangle className="h-3 w-3" />
        <span className="sr-only">Error</span>
      </span>
    );
  }

  // 'none'
  return (
    <span className="flex items-center gap-1.5 text-xs text-gray-400" title="No data for this range">
      <span className="inline-block h-2 w-2 rounded-full bg-gray-400" aria-hidden="true" />
      <span className="hidden sm:inline">No data for this range</span>
    </span>
  );
}
