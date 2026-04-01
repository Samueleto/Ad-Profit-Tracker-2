// Step 131: Utility functions for sync status display

import type { SyncPhase, OverallHealth } from '../types';

export function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
}

export interface PhaseDisplay {
  label: string;
  colorClass: string;
}

export function syncPhaseDisplay(phase: SyncPhase): PhaseDisplay {
  switch (phase) {
    case 'idle':
      return { label: 'Idle', colorClass: 'text-gray-500' };
    case 'fetching':
      return { label: 'Fetching Data', colorClass: 'text-blue-500' };
    case 'writing':
      return { label: 'Writing to DB', colorClass: 'text-yellow-500' };
    case 'complete':
      return { label: 'Complete', colorClass: 'text-green-500' };
    case 'failed':
      return { label: 'Failed', colorClass: 'text-red-500' };
    default:
      return { label: 'Unknown', colorClass: 'text-gray-400' };
  }
}

export interface HealthDisplay {
  bannerText: string;
  colorClass: string;
  bgClass: string;
}

export function healthDisplay(health: OverallHealth): HealthDisplay {
  switch (health) {
    case 'healthy':
      return {
        bannerText: 'All networks syncing normally',
        colorClass: 'text-green-700',
        bgClass: 'bg-green-50',
      };
    case 'degraded':
      return {
        bannerText: 'Some networks have sync issues',
        colorClass: 'text-yellow-700',
        bgClass: 'bg-yellow-50',
      };
    case 'critical':
      return {
        bannerText: 'Critical: multiple networks failing',
        colorClass: 'text-red-700',
        bgClass: 'bg-red-50',
      };
  }
}
