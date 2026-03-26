'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import type { LiveStateResponse, NetworkSyncState, ActivityFeedEntry, OverallHealth } from '../types';
import HealthBanner from './HealthBanner';
import NetworkStatusCard from './NetworkStatusCard';
import AnomalyAlertStrip from './AnomalyAlertStrip';
import ActivityFeedList from './ActivityFeedList';
import RefreshButton from './RefreshButton';

async function authFetch(path: string, forceRefresh = false): Promise<Response> {
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken(forceRefresh);
  return fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: 'no-store',
  });
}

async function apiFetch<T>(path: string): Promise<T | null> {
  let res = await authFetch(path);
  if (res.status === 401) res = await authFetch(path, true);
  if (!res.ok) return null;
  return res.json() as Promise<T>;
}

export default function SyncStatusPanel() {
  const [overallHealth, setOverallHealth] = useState<OverallHealth>('healthy');
  const [networks, setNetworks] = useState<NetworkSyncState[]>([]);
  const [loading, setLoading] = useState(true);
  const [criticalAnomalyCount, setCriticalAnomalyCount] = useState(0);
  const [activityEntries, setActivityEntries] = useState<ActivityFeedEntry[]>([]);
  const [activityOpen, setActivityOpen] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [noNetworks, setNoNetworks] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLiveState = useCallback(async () => {
    const data = await apiFetch<LiveStateResponse>('/api/sync/live-state');
    if (!data) return;
    setOverallHealth(data.overallHealth);
    if (data.networks.every(n => !n.isActive)) {
      setNoNetworks(true);
    } else {
      setNoNetworks(false);
      setNetworks(data.networks);
    }
    setLoading(false);
    return data;
  }, []);

  const fetchAnomalies = useCallback(async () => {
    const data = await apiFetch<{ anomalies: Array<{ severity: string }> }>('/api/reconciliation/anomalies');
    if (!data) return;
    const critical = data.anomalies?.filter((a) => a.severity === 'critical').length ?? 0;
    setCriticalAnomalyCount(critical);
  }, []);

  const resetPolling = useCallback((currentNetworks: NetworkSyncState[]) => {
    if (pollRef.current) clearInterval(pollRef.current);
    const hasActive = currentNetworks.some(
      n => n.syncPhase === 'fetching' || n.syncPhase === 'writing'
    );
    const interval = hasActive ? 5000 : 30000;
    pollRef.current = setInterval(async () => {
      const data = await apiFetch<LiveStateResponse>('/api/sync/live-state');
      if (!data) return;
      setOverallHealth(data.overallHealth);
      setNetworks(data.networks);
      const stillActive = data.networks.some(
        n => n.syncPhase === 'fetching' || n.syncPhase === 'writing'
      );
      if (!stillActive && interval === 5000) {
        // reset to 30s
        resetPolling(data.networks);
      } else if (stillActive && interval === 30000) {
        // speed up to 5s
        resetPolling(data.networks);
      }
    }, interval);
  }, []);

  const handleRefresh = useCallback(async () => {
    const data = await fetchLiveState();
    if (data) resetPolling(data.networks);
    fetchAnomalies();
  }, [fetchLiveState, resetPolling, fetchAnomalies]);

  useEffect(() => {
    (async () => {
      const data = await fetchLiveState();
      fetchAnomalies();
      if (data) resetPolling(data.networks);
    })();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchLiveState, fetchAnomalies, resetPolling]);

  const handleOpenActivity = useCallback(async () => {
    const next = !activityOpen;
    setActivityOpen(next);
    if (next && activityEntries.length === 0) {
      setActivityLoading(true);
      const data = await apiFetch<{ feed: ActivityFeedEntry[] }>('/api/sync/activity-feed?limit=5');
      setActivityEntries(data?.feed ?? []);
      setActivityLoading(false);
    }
  }, [activityOpen, activityEntries.length]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <NetworkStatusCard key={i} state={{} as NetworkSyncState} loading />
          ))}
        </div>
      </div>
    );
  }

  if (noNetworks) {
    return (
      <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
        No networks configured —{' '}
        <a href="/settings" className="text-blue-600 underline">add API keys in Settings</a>.
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Sync Status</h3>
        <RefreshButton onRefresh={handleRefresh} />
      </div>

      {/* Health Banner */}
      <HealthBanner overallHealth={overallHealth} />

      {/* Anomaly Alert Strip */}
      {criticalAnomalyCount > 0 && (
        <AnomalyAlertStrip
          criticalCount={criticalAnomalyCount}
          onViewDetails={() => {
            const el = document.getElementById('reconciliation');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
        />
      )}

      {/* Network Status Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {networks.map(n => (
          <NetworkStatusCard key={n.networkId} state={n} />
        ))}
      </div>

      {/* Recent Activity Section */}
      <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
        <button
          onClick={handleOpenActivity}
          className="flex items-center gap-1.5 w-full text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${activityOpen ? 'rotate-180' : ''}`}
          />
          Recent Activity
        </button>
        {activityOpen && (
          <div className="mt-3">
            {activityLoading ? (
              <div className="space-y-2 animate-pulse">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                    <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-800 rounded" />
                  </div>
                ))}
              </div>
            ) : (
              <ActivityFeedList entries={activityEntries} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
