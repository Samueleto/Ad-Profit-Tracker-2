'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import SeverityBadge, { type Severity } from './SeverityBadge';

export interface NotificationTypeConfig {
  label: string;
  description: string;
  severity: Severity;
  isCritical?: boolean;
}

interface NotificationToggleRowProps {
  config: NotificationTypeConfig;
  emailEnabled: boolean;
  onChange: (emailEnabled: boolean) => void;
  saveState?: 'idle' | 'saving' | 'saved' | 'error';
}

export default function NotificationToggleRow({ config, emailEnabled, onChange, saveState = 'idle' }: NotificationToggleRowProps) {
  const [showCheck, setShowCheck] = useState(false);

  useEffect(() => {
    if (saveState === 'saved') {
      setShowCheck(true);
      const t = setTimeout(() => setShowCheck(false), 1500);
      return () => clearTimeout(t);
    }
  }, [saveState]);

  return (
    <div className="flex items-start gap-3 py-3 px-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors rounded-lg">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{config.label}</span>
          {config.isCritical && (
            <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 px-1 py-0.5 rounded">Critical</span>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{config.description}</p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <SeverityBadge severity={config.severity} />

        {showCheck ? (
          <div className="w-8 h-4 flex items-center justify-center">
            <Check className="w-3.5 h-3.5 text-green-500" />
          </div>
        ) : (
          <button
            role="switch"
            aria-checked={emailEnabled}
            onClick={() => onChange(!emailEnabled)}
            disabled={saveState === 'saving'}
            className={`relative w-8 h-4 rounded-full transition-colors disabled:opacity-60 ${
              emailEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${
              emailEnabled ? 'translate-x-4' : 'translate-x-0.5'
            }`} />
          </button>
        )}
      </div>
    </div>
  );
}
