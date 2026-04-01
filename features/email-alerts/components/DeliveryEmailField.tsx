'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface DeliveryEmailFieldProps {
  value: string;
  initialValue: string;
  onChange: (v: string) => void;
  onSave: () => void;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
}

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export default function DeliveryEmailField({ value, initialValue, onChange, onSave, saveState }: DeliveryEmailFieldProps) {
  const [touched, setTouched] = useState(false);

  const isValid = isValidEmail(value);
  const hasChanged = value !== initialValue;
  const canSave = isValid && hasChanged && saveState !== 'saving';

  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
        Alert Delivery Email
      </label>
      <div className="flex gap-2">
        <div className="flex-1">
          <input
            type="email"
            value={value}
            onChange={e => { onChange(e.target.value); setTouched(true); }}
            onBlur={() => setTouched(true)}
            className={`w-full px-3 py-1.5 text-xs border rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 ${
              touched && !isValid
                ? 'border-red-400 focus:ring-red-400'
                : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
            }`}
          />
          {touched && !isValid && (
            <p className="mt-1 text-xs text-red-500">Please enter a valid email address.</p>
          )}
        </div>
        <button
          onClick={onSave}
          disabled={!canSave}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          {saveState === 'saving' && <Loader2 className="w-3 h-3 animate-spin" />}
          Save
        </button>
      </div>
      {saveState === 'error' && (
        <p className="mt-1 text-xs text-red-500">Failed to save email. Please try again.</p>
      )}
    </div>
  );
}
