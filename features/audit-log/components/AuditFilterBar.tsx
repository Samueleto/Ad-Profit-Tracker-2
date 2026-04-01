'use client';

import { useState, useCallback, useRef } from 'react';
import { X } from 'lucide-react';
import { AUDIT_ACTIONS, type AuditAction, type LogFilters } from '../types';

const ACTION_LABELS: Record<AuditAction, string> = {
  api_key_saved: 'API Key Saved',
  api_key_deleted: 'API Key Deleted',
  network_config_updated: 'Config Updated',
  network_config_reordered: 'Config Reordered',
  network_config_reset: 'Config Reset',
  network_connection_tested: 'Connection Tested',
  manual_sync_triggered: 'Sync Triggered',
  preferences_updated: 'Preferences Updated',
  profile_updated: 'Profile Updated',
  account_deleted: 'Account Deleted',
};

const DATE_PRESETS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
];

interface AuditFilterBarProps {
  onFiltersChange: (filters: LogFilters) => void;
}

function toISODate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

export default function AuditFilterBar({ onFiltersChange }: AuditFilterBarProps) {
  const [selectedActions, setSelectedActions] = useState<AuditAction[]>([]);
  const [datePreset, setDatePreset] = useState<number | null>(null);
  const [status, setStatus] = useState<'all' | 'success' | 'failure'>('all');
  const [search, setSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasFilters = selectedActions.length > 0 || datePreset !== null || status !== 'all' || search !== '';

  const emitFilters = useCallback((
    actions: AuditAction[],
    preset: number | null,
    st: 'all' | 'success' | 'failure',
    q: string,
  ) => {
    const filters: LogFilters = {};
    if (actions.length) filters.action = actions;
    if (preset !== null) {
      filters.startDate = toISODate(preset);
      filters.endDate = new Date().toISOString().split('T')[0];
    }
    if (st !== 'all') filters.status = st;
    if (q) filters.search = q;
    onFiltersChange(filters);
  }, [onFiltersChange]);

  const toggleAction = (action: AuditAction) => {
    const updated = selectedActions.includes(action)
      ? selectedActions.filter(a => a !== action)
      : [...selectedActions, action];
    setSelectedActions(updated);
    emitFilters(updated, datePreset, status, search);
  };

  const handleDatePreset = (days: number) => {
    const updated = datePreset === days ? null : days;
    setDatePreset(updated);
    emitFilters(selectedActions, updated, status, search);
  };

  const handleStatus = (s: 'all' | 'success' | 'failure') => {
    setStatus(s);
    emitFilters(selectedActions, datePreset, s, search);
  };

  const handleSearch = (q: string) => {
    setSearch(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      emitFilters(selectedActions, datePreset, status, q);
    }, 300);
  };

  const clearAll = () => {
    setSelectedActions([]);
    setDatePreset(null);
    setStatus('all');
    setSearch('');
    onFiltersChange({});
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 items-end">
        {/* Action multi-select */}
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Action Types</label>
          <div className="flex flex-wrap gap-1">
            {AUDIT_ACTIONS.map(action => (
              <button
                key={action}
                onClick={() => toggleAction(action)}
                className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                  selectedActions.includes(action)
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                {ACTION_LABELS[action]}
              </button>
            ))}
          </div>
        </div>

        {/* Date range presets */}
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Date Range</label>
          <div className="flex gap-1">
            {DATE_PRESETS.map(p => (
              <button
                key={p.days}
                onClick={() => handleDatePreset(p.days)}
                className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                  datePreset === p.days
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Status filter */}
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Status</label>
          <div className="flex gap-1">
            {(['all', 'success', 'failure'] as const).map(s => (
              <button
                key={s}
                onClick={() => handleStatus(s)}
                className={`px-2.5 py-1 text-xs rounded border capitalize transition-colors ${
                  status === s
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Search</label>
          <input
            type="text"
            value={search}
            onChange={e => handleSearch(e.target.value.slice(0, 100))}
            placeholder="Search logs…"
            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
          />
        </div>
      </div>

      {hasFilters && (
        <button
          onClick={clearAll}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <X className="w-3 h-3" />
          Clear filters
        </button>
      )}
    </div>
  );
}
