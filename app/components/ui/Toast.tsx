'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  variant?: ToastVariant;
  durationMs?: number;
  onClose?: () => void;
}

export function Toast({ message, variant = 'success', durationMs = 3000, onClose }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      onClose?.();
    }, durationMs);
    return () => clearTimeout(t);
  }, [durationMs, onClose]);

  if (!visible) return null;

  const styles = {
    success: 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-700 dark:text-green-400',
    error: 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-700 dark:text-red-400',
    info: 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-400',
  };

  const Icon = variant === 'success' ? CheckCircle : AlertCircle;

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 border rounded-lg shadow-lg text-sm max-w-sm animate-in slide-in-from-bottom-2 ${styles[variant]}`}
      role="alert"
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span>{message}</span>
      <button
        onClick={() => { setVisible(false); onClose?.(); }}
        className="ml-auto opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
