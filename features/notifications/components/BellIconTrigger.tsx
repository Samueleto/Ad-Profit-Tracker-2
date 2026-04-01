'use client';

import { Bell } from 'lucide-react';
import { useDashboardStore } from '@/store/dashboardStore';

export default function BellIconTrigger() {
  const unreadCount = useDashboardStore(s => s.notifications.unreadCount);
  const setOpen = useDashboardStore(s => s.setNotificationPanelOpen);

  const display = unreadCount > 99 ? '99+' : unreadCount > 0 ? String(unreadCount) : null;

  return (
    <button
      onClick={() => setOpen(true)}
      aria-label={display ? `Notifications, ${unreadCount} unread` : 'Notifications'}
      className="relative p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
    >
      <Bell className="w-5 h-5" />
      {display && (
        <span
          aria-hidden="true"
          className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 flex items-center justify-center text-[10px] font-bold bg-red-500 text-white rounded-full"
        >
          {display}
        </span>
      )}
    </button>
  );
}
