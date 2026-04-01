'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { NetworkSyncState } from '../types';
import { syncPhaseDisplay, formatRelativeTime } from '../utils';

interface NetworkStatusCardProps {
  state: NetworkSyncState;
  loading?: boolean;
}

const PHASE_BADGE: Record<string, string> = {
  fetching: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  writing: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  complete: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  idle: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

const NETWORK_LABELS: Record<string, string> = {
  exoclick: 'ExoClick',
  rollerads: 'RollerAds',
  zeydoo: 'Zeydoo',
  propush: 'Propush',
};

export default function NetworkStatusCard({ state, loading = false }: NetworkStatusCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 animate-pulse">
        <div className="flex items-center justify-between mb-3">
          <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-32 bg-gray-100 dark:bg-gray-800 rounded" />
          <div className="h-3 w-24 bg-gray-100 dark:bg-gray-800 rounded" />
          <div className="h-3 w-20 bg-gray-100 dark:bg-gray-800 rounded" />
        </div>
      </div>
    );
  }

  const phase = syncPhaseDisplay(state.syncPhase);
  const badgeClass = PHASE_BADGE[state.syncPhase] ?? PHASE_BADGE.idle;
  const isPulsing = state.syncPhase === 'fetching' || state.syncPhase === 'writing';

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-900 dark:text-white">
          {NETWORK_LABELS[state.networkId] ?? state.networkId}
        </span>
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${badgeClass}`}>
          {isPulsing && (
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          )}
          {phase.label}
        </span>
      </div>

      {/* Stats */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div>
          <dt className="text-gray-500 dark:text-gray-400">Last synced</dt>
          <dd className="text-gray-800 dark:text-gray-200">
            {state.lastSyncedAt ? formatRelativeTime(state.lastSyncedAt) : 'Never'}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500 dark:text-gray-400">Latest data</dt>
          <dd className="text-gray-800 dark:text-gray-200">{state.latestDataDate ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-gray-500 dark:text-gray-400">Rows fetched</dt>
          <dd className="text-gray-800 dark:text-gray-200">{state.lastRowsFetched ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-gray-500 dark:text-gray-400">Latency</dt>
          <dd className="text-gray-800 dark:text-gray-200">
            {state.lastLatencyMs != null ? `${state.lastLatencyMs}ms` : '—'}
          </dd>
        </div>
      </dl>

      {/* Circuit breaker badge */}
      <div className="mt-2 flex items-center justify-between">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          state.circuitBreakerOpen
            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
        }`}>
          CB: {state.circuitBreakerOpen ? 'Open' : 'Closed'}
        </span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          aria-expanded={expanded}
          aria-label="Toggle circuit breaker details"
        >
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <dl className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          <div>
            <dt className="text-gray-500 dark:text-gray-400">CB Opened At</dt>
            <dd className="text-gray-800 dark:text-gray-200">
              {state.circuitBreakerOpenedAt ? formatRelativeTime(state.circuitBreakerOpenedAt) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Retry Count</dt>
            <dd className="text-gray-800 dark:text-gray-200">{state.retryCount}</dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Total Failures</dt>
            <dd className="text-gray-800 dark:text-gray-200">{state.totalFailureCount}</dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Last Error</dt>
            <dd className="text-gray-800 dark:text-gray-200 truncate">{state.lastErrorCode ?? '—'}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
