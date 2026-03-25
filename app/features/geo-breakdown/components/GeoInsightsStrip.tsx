'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { GeoCountryRow } from '../types';

interface GeoInsightsStripProps {
  topCountry: GeoCountryRow | null;
  worstCountry: GeoCountryRow | null;
  positiveRoiCount: number;
  totalCountries: number;
}

export default function GeoInsightsStrip({
  topCountry,
  worstCountry,
  positiveRoiCount,
  totalCountries,
}: GeoInsightsStripProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 mt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 w-full"
      >
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
        <span>Geo Insights</span>
      </button>

      {expanded && (
        <div className="flex flex-wrap gap-4 px-4 pb-4">
          <div className="min-w-[120px]">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Top Country</p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {topCountry ? `${topCountry.flagEmoji} ${topCountry.countryName}` : '—'}
            </p>
            <p className="text-sm font-semibold text-green-600">
              {topCountry?.netProfit != null ? `$${topCountry.netProfit.toFixed(2)}` : '—'}
            </p>
          </div>

          <div className="min-w-[120px]">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Worst Country</p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {worstCountry ? `${worstCountry.flagEmoji} ${worstCountry.countryName}` : '—'}
            </p>
            <p className="text-sm font-semibold text-red-600">
              {worstCountry?.netProfit != null ? `$${worstCountry.netProfit.toFixed(2)}` : '—'}
            </p>
          </div>

          <div className="min-w-[100px]">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Profitable Countries</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{positiveRoiCount}</p>
            <p className="text-xs text-gray-500">of {totalCountries}</p>
          </div>

          <div className="min-w-[100px]">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Positive ROI Rate</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {totalCountries > 0 ? `${Math.round((positiveRoiCount / totalCountries) * 100)}%` : '—'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
