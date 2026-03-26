'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface ROIBreakdownPanelProps {
  revenue: number;
  cost: number;
  roi: number | null;
}

function fmt(v: number): string {
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ROIBreakdownPanel({ revenue, cost, roi }: ROIBreakdownPanelProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-t border-gray-100 dark:border-gray-800 mt-2 pt-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 py-1"
        aria-expanded={expanded}
      >
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
        ROI Breakdown
      </button>

      <div
        className={`overflow-hidden transition-all duration-300 ${expanded ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="py-2 text-xs text-gray-700 dark:text-gray-300 space-y-1">
          <p className="font-mono text-gray-500 dark:text-gray-400">
            (Revenue − Cost) ÷ Cost × 100
          </p>
          <p className="font-mono">
            ({fmt(revenue)} − {fmt(cost)}) ÷ {fmt(cost)} × 100
          </p>
          <p className="font-semibold">
            = {roi != null ? `${roi.toFixed(2)}%` : cost === 0 ? 'N/A (cost is $0)' : 'N/A'}
          </p>
        </div>
      </div>
    </div>
  );
}
