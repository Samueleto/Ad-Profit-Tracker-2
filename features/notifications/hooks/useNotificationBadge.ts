'use client';

import { useEffect, useRef, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import { useDashboardStore } from '@/store/dashboardStore';

const POLL_INTERVAL_MS = 60_000; // 1 minute

export function useNotificationBadge() {
  const setUnreadCount = useDashboardStore(s => s.setUnreadCount);
  const panelOpen = useDashboardStore(s => s.notifications.panelOpen);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const fetchCount = useCallback(async () => {
    if (!mountedRef.current) return;
    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) return; // not signed in
      const res = await fetch('/api/notifications/unread-count', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return; // silent — badge stays at last known value
      const data = await res.json();
      if (mountedRef.current && typeof data.count === 'number') {
        setUnreadCount(data.count);
      }
    } catch {
      // Network error — silent, will retry next interval
    }
  }, [setUnreadCount]);

  useEffect(() => {
    mountedRef.current = true;

    const schedule = () => {
      timerRef.current = setTimeout(async () => {
        if (!mountedRef.current) return;
        await fetchCount();
        if (mountedRef.current) schedule();
      }, POLL_INTERVAL_MS);
    };

    // Fetch immediately, then start polling
    fetchCount();
    schedule();

    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fetchCount]);

  // Re-fetch immediately when the notification panel closes
  // (user may have read notifications — keep badge in sync)
  const prevPanelOpen = useRef(panelOpen);
  useEffect(() => {
    if (prevPanelOpen.current && !panelOpen) {
      fetchCount();
    }
    prevPanelOpen.current = panelOpen;
  }, [panelOpen, fetchCount]);
}
