'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { RefreshCw, XCircle, Download, Clock, X } from 'lucide-react';
import type { AppNotification } from '../types';

const BORDER_COLOR: Record<string, string> = {
  success: 'border-green-400',
  error: 'border-red-400',
  warning: 'border-amber-400',
  info: 'border-blue-400',
};

const BG_UNREAD: Record<string, string> = {
  success: 'bg-green-50/50 dark:bg-green-900/10',
  error: 'bg-red-50/50 dark:bg-red-900/10',
  warning: 'bg-amber-50/50 dark:bg-amber-900/10',
  info: 'bg-blue-50/50 dark:bg-blue-900/10',
};

function getIcon(type: string) {
  if (type.startsWith('sync')) return <RefreshCw className="w-3.5 h-3.5" />;
  if (type.startsWith('export')) return <Download className="w-3.5 h-3.5" />;
  if (type.startsWith('schedule')) return <Clock className="w-3.5 h-3.5" />;
  return <XCircle className="w-3.5 h-3.5" />;
}

function formatTime(createdAt: string | { seconds: number }): string {
  try {
    const date = typeof createdAt === 'string'
      ? parseISO(createdAt)
      : new Date((createdAt as { seconds: number }).seconds * 1000);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return '';
  }
}

interface NotificationRowProps {
  notification: AppNotification;
  onDismiss: (id: string) => void;
}

export default function NotificationRow({ notification, onDismiss }: NotificationRowProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [timeLabel, setTimeLabel] = useState(() => formatTime(notification.createdAt as string));

  // Update relative time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLabel(formatTime(notification.createdAt as string));
    }, 60000);
    return () => clearInterval(timer);
  }, [notification.createdAt]);

  const handleRowClick = () => {
    if (notification.type === 'sync_failure') {
      router.push('/dashboard#sync');
    } else if (notification.type === 'schedule_failed') {
      router.push('/reports');
    } else {
      setExpanded(v => !v);
    }
  };

  const borderColor = BORDER_COLOR[notification.severity] ?? BORDER_COLOR.info;
  const bgColor = !notification.isRead ? (BG_UNREAD[notification.severity] ?? '') : '';

  return (
    <div className={`border-l-4 ${borderColor} ${bgColor} transition-colors`}>
      <div
        className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors"
        onClick={handleRowClick}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter') handleRowClick(); }}
      >
        <span className={`mt-0.5 flex-shrink-0 ${
          notification.severity === 'error' ? 'text-red-500' :
          notification.severity === 'success' ? 'text-green-500' :
          notification.severity === 'warning' ? 'text-amber-500' : 'text-blue-500'
        }`}>
          {getIcon(notification.type)}
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-snug">{notification.title}</p>
          <p className={`text-xs text-gray-500 dark:text-gray-400 leading-snug mt-0.5 ${expanded ? '' : 'truncate'}`}>
            {notification.body}
          </p>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 ml-1">
          <span className="text-[10px] text-gray-400 whitespace-nowrap">{timeLabel}</span>
          <button
            onClick={e => { e.stopPropagation(); onDismiss(notification.id); }}
            aria-label="Dismiss notification"
            className="p-0.5 text-gray-300 hover:text-gray-500 dark:hover:text-gray-400 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
