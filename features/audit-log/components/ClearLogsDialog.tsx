'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface ClearLogsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function ClearLogsDialog({ isOpen, onClose, onConfirm }: ClearLogsDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    setStep(1);
    setConfirmText('');
    onClose();
  };

  const handleFirstConfirm = () => setStep(2);

  const handleFinalConfirm = async () => {
    if (confirmText !== 'DELETE') return;
    setLoading(true);
    try {
      await onConfirm();
      handleClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Clear All Audit Logs</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">This action cannot be undone.</p>
          </div>
        </div>

        {step === 1 ? (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
              All audit log records will be permanently deleted. This includes all activity history for your account.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleFirstConfirm}
                className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Yes, delete all logs
              </button>
              <button
                onClick={handleClose}
                className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Type <strong className="text-gray-900 dark:text-white font-mono">DELETE</strong> to confirm:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="DELETE"
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-800 dark:text-white font-mono"
            />
            <div className="flex gap-3">
              <button
                onClick={handleFinalConfirm}
                disabled={confirmText !== 'DELETE' || loading}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm Delete
              </button>
              <button
                onClick={handleClose}
                disabled={loading}
                className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
