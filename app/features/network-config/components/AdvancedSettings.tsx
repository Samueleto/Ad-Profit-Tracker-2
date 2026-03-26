'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { NetworkConfigUpdate } from '../types';

interface AdvancedSettingsProps {
  endpointOverride: string | null;
  timeoutSeconds: number;
  retryAttempts: number;
  disabled?: boolean;
  onChange: (update: NetworkConfigUpdate) => void;
}

export default function AdvancedSettings({
  endpointOverride,
  timeoutSeconds,
  retryAttempts,
  disabled,
  onChange,
}: AdvancedSettingsProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-gray-100 dark:border-gray-800 mt-3 pt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
      >
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
        Advanced Settings
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              API Endpoint Override
            </label>
            <input
              type="url"
              value={endpointOverride ?? ''}
              onChange={e => onChange({ endpointOverride: e.target.value || null })}
              disabled={disabled}
              placeholder="https://api.example.com/v2"
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white disabled:opacity-50"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Timeout (seconds)
              </label>
              <input
                type="number"
                min={5}
                max={120}
                value={timeoutSeconds}
                onChange={e => onChange({ timeoutSeconds: Number(e.target.value) })}
                disabled={disabled}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white disabled:opacity-50"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Retry Attempts
              </label>
              <input
                type="number"
                min={0}
                max={5}
                value={retryAttempts}
                onChange={e => onChange({ retryAttempts: Number(e.target.value) })}
                disabled={disabled}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white disabled:opacity-50"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
