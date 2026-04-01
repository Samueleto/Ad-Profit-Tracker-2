'use client';

import { useState } from 'react';

interface BenchmarkMetricRowProps {
  metric: string;
  label: string;
  systemDefault: number;
  currentTarget: number | null;
  useDefault: boolean;
  unit: string;
  loading?: boolean;
  onChange: (metric: string, value: number | null, useDefault: boolean) => void;
}

export default function BenchmarkMetricRow({
  metric, label, systemDefault, currentTarget, useDefault, unit, loading, onChange,
}: BenchmarkMetricRowProps) {
  const [localValue, setLocalValue] = useState<string>(
    currentTarget != null ? String(currentTarget) : String(systemDefault)
  );
  const [localUseDefault, setLocalUseDefault] = useState(useDefault);

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-2.5 animate-pulse">
        <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="w-24 h-8 bg-gray-100 dark:bg-gray-800 rounded" />
        <div className="w-20 h-6 bg-gray-200 dark:bg-gray-700 rounded-full" />
        <div className="w-14 h-7 bg-gray-100 dark:bg-gray-800 rounded" />
      </div>
    );
  }

  const handleToggle = (v: boolean) => {
    setLocalUseDefault(v);
    onChange(metric, v ? null : Number(localValue), v);
  };

  const handleValueChange = (v: string) => {
    setLocalValue(v);
    const num = parseFloat(v);
    if (!isNaN(num)) onChange(metric, num, localUseDefault);
  };

  const handleReset = () => {
    setLocalValue(String(systemDefault));
    setLocalUseDefault(true);
    onChange(metric, null, true);
  };

  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">Default: {systemDefault}{unit}</p>
      </div>

      <input
        type="number"
        value={localValue}
        onChange={e => handleValueChange(e.target.value)}
        disabled={localUseDefault}
        className="w-24 px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white disabled:opacity-40 disabled:cursor-not-allowed"
      />

      {/* Toggle */}
      <button
        role="switch"
        aria-checked={localUseDefault}
        onClick={() => handleToggle(!localUseDefault)}
        title="Use industry default"
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
          localUseDefault ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      >
        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ${localUseDefault ? 'translate-x-4' : 'translate-x-1'}`} />
      </button>

      <button
        onClick={handleReset}
        className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline"
      >
        Reset
      </button>
    </div>
  );
}
