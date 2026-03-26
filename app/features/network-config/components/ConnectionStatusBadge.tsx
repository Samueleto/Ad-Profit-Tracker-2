'use client';

import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

type ConnectionStatus = 'connected' | 'not_connected' | 'error';

interface ConnectionStatusBadgeProps {
  status: ConnectionStatus;
}

const CONFIG: Record<ConnectionStatus, { icon: React.ElementType; label: string; className: string }> = {
  connected: {
    icon: CheckCircle,
    label: 'Connected',
    className: 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
  },
  not_connected: {
    icon: XCircle,
    label: 'Not connected',
    className: 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800',
  },
  error: {
    icon: AlertCircle,
    label: 'Error',
    className: 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
  },
};

export default function ConnectionStatusBadge({ status }: ConnectionStatusBadgeProps) {
  const { icon: Icon, label, className } = CONFIG[status] ?? CONFIG.not_connected;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}
