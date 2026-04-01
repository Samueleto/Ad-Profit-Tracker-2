'use client';

import type { AuditAction } from '../types';

interface ActionTypeBadgeProps {
  action: AuditAction;
  status?: 'success' | 'failure';
}

const GREEN_ACTIONS: AuditAction[] = ['api_key_saved', 'network_connection_tested'];
const RED_ACTIONS: AuditAction[] = ['api_key_deleted', 'account_deleted'];
const AMBER_ACTIONS: AuditAction[] = ['manual_sync_triggered'];

const LABELS: Record<AuditAction, string> = {
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

function getColorClass(action: AuditAction): string {
  if (GREEN_ACTIONS.includes(action)) return 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400';
  if (RED_ACTIONS.includes(action)) return 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400';
  if (AMBER_ACTIONS.includes(action)) return 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400';
  // blue for config/profile/preference
  return 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400';
}

export default function ActionTypeBadge({ action, status }: ActionTypeBadgeProps) {
  const colorClass = getColorClass(action);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {LABELS[action] ?? action}
      {status === 'failure' && (
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block ml-0.5" title="Failed" />
      )}
    </span>
  );
}
