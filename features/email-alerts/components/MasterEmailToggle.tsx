'use client';

import { useRef, useEffect } from 'react';

interface MasterEmailToggleProps {
  allEnabled: boolean;
  someEnabled: boolean;
  onChange: (enabled: boolean) => void;
}

export default function MasterEmailToggle({ allEnabled, someEnabled, onChange }: MasterEmailToggleProps) {
  const checkboxRef = useRef<HTMLInputElement>(null);
  const isIndeterminate = someEnabled && !allEnabled;

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
      <div>
        <p className="text-sm font-semibold text-gray-900 dark:text-white">Email Alerts</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {allEnabled ? 'All alert types enabled' : someEnabled ? 'Some alert types enabled' : 'All alert types disabled'}
        </p>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          ref={checkboxRef}
          type="checkbox"
          checked={allEnabled}
          onChange={e => onChange(e.target.checked)}
          className="w-4 h-4 rounded accent-blue-600"
          aria-label="Toggle all email alerts"
        />
        <span className="text-xs text-gray-600 dark:text-gray-400">{allEnabled ? 'All on' : someEnabled ? 'Partial' : 'All off'}</span>
      </label>
    </div>
  );
}
