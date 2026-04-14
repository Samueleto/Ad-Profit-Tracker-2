'use client';

import { useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import type { NetworkConfig, NetworkConfigUpdate } from '../types';
import ConnectionStatusBadge from './ConnectionStatusBadge';
import SyncScheduleSelector from './SyncScheduleSelector';
import AdvancedSettings from './AdvancedSettings';

interface NetworkCardProps {
  config: NetworkConfig;
  networkName: string;
  connectionStatus: 'connected' | 'not_connected' | 'error';
  disabled?: boolean;
  onUpdate: (networkId: string, update: NetworkConfigUpdate) => Promise<void>;
}

export default function NetworkCard({
  config,
  networkName,
  connectionStatus,
  disabled = false,
  onUpdate,
}: NetworkCardProps) {
  const [localConfig, setLocalConfig] = useState(config);
  const [saving, setSaving] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  const handleUpdate = async (update: NetworkConfigUpdate) => {
    const prev = localConfig;
    setLocalConfig({ ...localConfig, ...update });
    setCardError(null);
    setSaving(true);
    try {
      await onUpdate(config.networkId, update);
    } catch (err) {
      // Revert optimistic update
      setLocalConfig(prev);
      setCardError(err instanceof Error ? err.message : `Failed to save ${networkName} settings.`);
    } finally {
      setSaving(false);
    }
  };

  const lastSyncedLabel = localConfig.lastSyncedAt
    ? new Date((localConfig.lastSyncedAt as unknown as { toDate: () => Date }).toDate?.() ?? localConfig.lastSyncedAt).toLocaleString()
    : 'Never';

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{networkName}</h3>
            <ConnectionStatusBadge status={connectionStatus} />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Last synced: {lastSyncedLabel}
            {localConfig.lastSyncStatus && (
              <span className={`ml-1.5 ${localConfig.lastSyncStatus === 'failed' ? 'text-red-500' : ''}`}>
                ({localConfig.lastSyncStatus})
              </span>
            )}
          </p>
        </div>

        {/* Active toggle */}
        <button
          role="switch"
          aria-checked={localConfig.isActive}
          onClick={() => handleUpdate({ isActive: !localConfig.isActive })}
          disabled={disabled || saving}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 flex-shrink-0 ${
            localConfig.isActive ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              localConfig.isActive ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Sync schedule */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">Sync:</span>
        <SyncScheduleSelector
          value={localConfig.syncSchedule}
          onChange={schedule => handleUpdate({ syncSchedule: schedule })}
          disabled={disabled || saving || !localConfig.isActive}
        />
      </div>

      {/* Advanced settings */}
      <AdvancedSettings
        endpointOverride={localConfig.endpointOverride}
        timeoutSeconds={localConfig.timeoutSeconds}
        retryAttempts={localConfig.retryAttempts}
        disabled={disabled || saving}
        onChange={update => handleUpdate(update)}
      />

      {/* Inline card error banner (dismissible) */}
      {cardError && (
        <div className="mt-3 flex items-center justify-between gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <span className="flex items-center gap-1.5 text-xs text-red-700 dark:text-red-400">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {cardError}
          </span>
          <button onClick={() => setCardError(null)} className="text-red-400 hover:text-red-600 flex-shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Sync error message */}
      {!cardError && localConfig.lastSyncError && connectionStatus === 'error' && (
        <p className="mt-2 text-xs text-red-500 truncate" title={localConfig.lastSyncError}>
          Error: {localConfig.lastSyncError}
        </p>
      )}
    </div>
  );
}
