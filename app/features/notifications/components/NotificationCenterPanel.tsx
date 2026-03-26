'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2 } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import { useDashboardStore } from '@/store/dashboardStore';
import type { AppNotification, GetNotificationsResponse } from '../types';
import NotificationRow from './NotificationRow';
import NotificationSkeletonRow from './NotificationSkeletonRow';
import NotificationEmptyState from './NotificationEmptyState';
import NotificationErrorBanner from './NotificationErrorBanner';

type Tab = 'all' | 'unread';

export default function NotificationCenterPanel() {
  const router = useRouter();
  const isOpen = useDashboardStore(s => s.notifications.panelOpen);
  const unreadCount = useDashboardStore(s => s.notifications.unreadCount);
  const setOpen = useDashboardStore(s => s.setNotificationPanelOpen);
  const setUnreadCount = useDashboardStore(s => s.setUnreadCount);

  const [tab, setTab] = useState<Tab>('all');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const getToken = useCallback(async (refresh = false): Promise<Record<string, string>> => {
    const auth = getAuth();
    const token = await auth.currentUser?.getIdToken(refresh);
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchNotifications = useCallback(async (nextCursor?: string) => {
    const isLoadMore = !!nextCursor;
    isLoadMore ? setLoadingMore(true) : setLoading(true);
    setErrorCode(null);
    try {
      const url = `/api/notifications?limit=20${nextCursor ? `&cursor=${nextCursor}` : ''}`;
      let headers = await getToken();
      let res = await fetch(url, { headers });
      if (res.status === 401) {
        try {
          headers = await getToken(true);
          res = await fetch(url, { headers });
          if (res.status === 401) { setOpen(false); router.push('/'); return; }
        } catch { setOpen(false); router.push('/'); return; }
      }
      if (!res.ok) { setErrorCode(res.status); return; }
      const data: GetNotificationsResponse = await res.json();
      setNotifications(prev => isLoadMore ? [...prev, ...data.notifications] : data.notifications);
      setHasMore(data.hasMore);
      setCursor(data.nextCursor);
      setUnreadCount(data.unreadCount);
    } catch { setErrorCode(500); }
    finally { isLoadMore ? setLoadingMore(false) : setLoading(false); }
  }, [getToken, setOpen, setUnreadCount, router]);

  useEffect(() => {
    if (isOpen) fetchNotifications();
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, setOpen]);

  // Focus trap
  useEffect(() => {
    if (isOpen) panelRef.current?.focus();
  }, [isOpen]);

  const handleDismiss = async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    const headers = await getToken();
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH', headers });
    setUnreadCount(Math.max(0, unreadCount - 1));
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    const headers = await getToken();
    const res = await fetch('/api/notifications/bulk-read', { method: 'PATCH', headers });
    if (res.ok) {
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    }
  };

  const handleClearAll = async () => {
    const headers = await getToken();
    await fetch('/api/notifications', { method: 'DELETE', headers });
    setNotifications([]);
    setUnreadCount(0);
    setConfirmClear(false);
  };

  const displayed = tab === 'unread' ? notifications.filter(n => !n.isRead) : notifications;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setOpen(false)} aria-hidden="true" />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-label="Notifications"
        aria-modal="true"
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[360px] bg-white dark:bg-gray-900 shadow-2xl flex flex-col outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0}
              className="text-xs text-blue-600 dark:text-blue-400 disabled:opacity-40 disabled:cursor-not-allowed hover:underline"
            >
              Mark all read
            </button>
            {confirmClear ? (
              <div className="flex items-center gap-1">
                <button onClick={handleClearAll} className="text-xs text-red-600 font-medium hover:underline">Clear</button>
                <button onClick={() => setConfirmClear(false)} className="text-xs text-gray-400">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setConfirmClear(true)} className="text-xs text-gray-500 hover:text-red-500 transition-colors">Clear all</button>
            )}
            <button onClick={() => setOpen(false)} className="ml-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-4">
          {(['all', 'unread'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-2 px-3 text-xs font-medium border-b-2 capitalize transition-colors ${
                tab === t
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
              {t === 'unread' && unreadCount > 0 && (
                <span className="ml-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 text-[10px] font-bold px-1 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Error */}
        {errorCode && (
          <NotificationErrorBanner
            code={errorCode}
            onRetry={() => fetchNotifications()}
            onClose={() => setOpen(false)}
          />
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700/50">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => <NotificationSkeletonRow key={i} />)
            : displayed.length === 0
            ? <NotificationEmptyState />
            : displayed.map(n => (
                <NotificationRow key={n.id} notification={n} onDismiss={handleDismiss} />
              ))
          }
        </div>

        {/* Load more */}
        {hasMore && !loading && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-center">
            <button
              onClick={() => cursor && fetchNotifications(cursor)}
              disabled={loadingMore}
              className="flex items-center gap-1.5 mx-auto text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-60"
            >
              {loadingMore && <Loader2 className="w-3 h-3 animate-spin" />}
              Load more
            </button>
          </div>
        )}
      </div>
    </>
  );
}
