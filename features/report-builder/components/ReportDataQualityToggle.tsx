'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { ALLOWED_DATA_QUALITY, type ReportDataQuality } from '../types';

const QUALITY_LABELS: Record<ReportDataQuality, string> = {
  all: 'All',
  anomalies: 'Anomalies Only',
  clean: 'Clean Only',
};

interface ReportDataQualityToggleProps {
  value: string;
  onChange: (quality: string) => void;
}

export default function ReportDataQualityToggle({ value, onChange }: ReportDataQualityToggleProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 w-full text-left"
      >
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex-1">Advanced Options</h3>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/50">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Data Quality</p>
          <div className="flex gap-1 flex-wrap">
            {ALLOWED_DATA_QUALITY.map(option => (
              <button
                key={option}
                onClick={() => onChange(option)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  value === option
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400'
                }`}
              >
                {QUALITY_LABELS[option]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
