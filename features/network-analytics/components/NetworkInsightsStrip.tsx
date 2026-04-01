'use client';

import { useState } from 'react';
import { ChevronDown, Loader2, RefreshCw } from 'lucide-react';

interface GeoRow {
  countryName: string;
  flagEmoji?: string;
  primaryMetric: number | null;
}

interface NetworkInsightsStripProps {
  networkId: string;
  bestCountry: GeoRow | null;
  worstCountry: GeoRow | null;
  totalCountries: number;
  lastSyncedAt: string | null;
  isSyncing?: boolean;
  onSync: (networkId: string) => void;
}

export default function NetworkInsightsStrip({
  networkId,
  bestCountry,
  worstCountry,
  totalCountries,
  lastSyncedAt,
  isSyncing = false,
  onSync,
}: NetworkInsightsStripProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 mt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 px-1 py-2 w-full"
      >
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        Network Insights
      </button>

      {expanded && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pb-3 px-1">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Best Country</p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {bestCountry ? `${bestCountry.flagEmoji ?? ''} ${bestCountry.countryName}` : '—'}
            </p>
            <p className="text-xs text-green-600">
              {bestCountry?.primaryMetric != null ? `$${bestCountry.primaryMetric.toFixed(2)}` : ''}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Worst Country</p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {worstCountry ? `${worstCountry.flagEmoji ?? ''} ${worstCountry.countryName}` : '—'}
            </p>
            <p className="text-xs text-red-500">
              {worstCountry?.primaryMetric != null ? `$${worstCountry.primaryMetric.toFixed(2)}` : ''}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Countries Tracked</p>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{totalCountries}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Last Synced</p>
            <p className="text-xs text-gray-700 dark:text-gray-300">
              {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : 'Never'}
            </p>
            <button
              onClick={() => onSync(networkId)}
              disabled={isSyncing}
              className="mt-1.5 flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50 transition-colors"
            >
              {isSyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Sync
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
