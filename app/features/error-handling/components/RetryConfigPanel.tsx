'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import { AlertCircle, Edit2, Check, X } from 'lucide-react';

const NETWORKS = ['exoclick', 'rollerads', 'zeydoo', 'propush'] as const;
type Network = typeof NETWORKS[number];

interface BackoffEntry { attempt: number; delay: number; jitter: string }

interface NetworkConfig {
  networkId: Network;
  retryAttempts: number;
  timeoutSeconds: number;
  backoffSchedule?: BackoffEntry[];
}

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken();
  return fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

export default function RetryConfigPanel() {
  const [configs, setConfigs] = useState<NetworkConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<Network | null>(null);
  const [editRetry, setEditRetry] = useState(3);
  const [editTimeout, setEditTimeout] = useState(30);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await authFetch('/api/errors/retry-config');
      if (!res.ok) { setError(true); return; }
      const data = await res.json();
      setConfigs(data.configs ?? data.networks ?? []);
    } catch { setError(true); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  const startEdit = (config: NetworkConfig) => {
    setEditing(config.networkId);
    setEditRetry(config.retryAttempts);
    setEditTimeout(config.timeoutSeconds);
    setSaveError(null);
    setValidationErrors({});
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (editRetry < 1 || editRetry > 5) errs.retryAttempts = 'Must be 1–5';
    if (editTimeout < 5 || editTimeout > 60) errs.timeoutSeconds = 'Must be 5–60';
    return errs;
  };

  const handleSave = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setValidationErrors(errs); return; }
    setValidationErrors({});
    setSaving(true);
    setSaveError(null);
    try {
      const res = await authFetch('/api/errors/retry-config', {
        method: 'PATCH',
        body: JSON.stringify({ networkId: editing, retryAttempts: editRetry, timeoutSeconds: editTimeout }),
      });
      if (res.status === 429) { setSaveError('Rate limit — try again later.'); return; }
      if (!res.ok) { setSaveError('Failed to save config.'); return; }
      setEditing(null);
      fetchConfigs();
    } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-500">
        <AlertCircle className="w-4 h-4" /> Failed to load retry config.
        <button onClick={fetchConfigs} className="underline text-xs">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {configs.map(config => (
        <div key={config.networkId} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">{config.networkId}</p>
            {editing !== config.networkId && (
              <button onClick={() => startEdit(config)}
                className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">
                <Edit2 className="w-3 h-3" /> Edit
              </button>
            )}
          </div>

          {editing === config.networkId ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-4">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Retry Attempts (1–5)</label>
                  <input type="number" min={1} max={5} value={editRetry} onChange={e => setEditRetry(Number(e.target.value))}
                    className="w-20 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white" />
                  {validationErrors.retryAttempts && <p className="text-xs text-red-500 mt-1">{validationErrors.retryAttempts}</p>}
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Timeout Seconds (5–60)</label>
                  <input type="number" min={5} max={60} value={editTimeout} onChange={e => setEditTimeout(Number(e.target.value))}
                    className="w-24 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white" />
                  {validationErrors.timeoutSeconds && <p className="text-xs text-red-500 mt-1">{validationErrors.timeoutSeconds}</p>}
                </div>
              </div>
              {saveError && <p className="text-xs text-amber-600 dark:text-amber-400">{saveError}</p>}
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors">
                  <Check className="w-3 h-3" /> Save
                </button>
                <button onClick={() => setEditing(null)} disabled={saving}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors">
                  <X className="w-3 h-3" /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-6 text-xs text-gray-600 dark:text-gray-400">
                <span>Retries: <strong className="text-gray-900 dark:text-white">{config.retryAttempts}</strong></span>
                <span>Timeout: <strong className="text-gray-900 dark:text-white">{config.timeoutSeconds}s</strong></span>
              </div>
              {config.backoffSchedule && config.backoffSchedule.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="text-xs border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        {['Attempt', 'Delay', 'Jitter'].map(h => (
                          <th key={h} className="px-3 py-1.5 text-left font-medium text-gray-400 dark:text-gray-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {config.backoffSchedule.map((b, i) => (
                        <tr key={i}>
                          <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{b.attempt}</td>
                          <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{b.delay}s</td>
                          <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400">{b.jitter}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {configs.length === 0 && (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">No retry configs found.</p>
      )}
    </div>
  );
}
