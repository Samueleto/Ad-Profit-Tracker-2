'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import { AlertCircle, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import type { ValidationRules } from '../types';

const NETWORKS = ['exoclick', 'rollerads', 'zeydoo', 'propush'] as const;

const SYSTEM_DEFAULTS: ValidationRules = {
  maxDailyRevenueUSD: 50000,
  minDailyRevenueUSD: 0,
  maxDailyCostUSD: 50000,
  maxCtrPercent: 50,
  minImpressions: 0,
  allowNullCountry: true,
};

const FIELD_LABELS: Record<keyof ValidationRules, string> = {
  maxDailyRevenueUSD: 'Max Daily Revenue (USD)',
  minDailyRevenueUSD: 'Min Daily Revenue (USD)',
  maxDailyCostUSD: 'Max Daily Cost (USD)',
  maxCtrPercent: 'Max CTR (%)',
  minImpressions: 'Min Impressions',
  allowNullCountry: 'Allow Null Country',
};

interface NetworkRules {
  networkId: string;
  rules: Partial<ValidationRules>;
  isCustom?: boolean;
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

export default function ValidationRulesEditor() {
  const [networkRules, setNetworkRules] = useState<NetworkRules[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [edits, setEdits] = useState<Record<string, Partial<ValidationRules>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});

  const fetchRules = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await authFetch('/api/reconciliation/rules');
      if (!res.ok) { setError(true); return; }
      const data = await res.json();
      setNetworkRules(data.networks ?? data.rules ?? NETWORKS.map(id => ({ networkId: id, rules: {}, isCustom: false })));
    } catch { setError(true); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const toggleExpand = (networkId: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(networkId)) { next.delete(networkId); } else { next.add(networkId); }
      return next;
    });
  };

  const handleFieldChange = (networkId: string, field: keyof ValidationRules, value: string) => {
    setEdits(prev => {
      const networkEdits = prev[networkId] ?? {};
      if (field === 'allowNullCountry') {
        return { ...prev, [networkId]: { ...networkEdits, [field]: value === 'true' } };
      }
      return { ...prev, [networkId]: { ...networkEdits, [field]: Number(value) } };
    });
  };

  const handleSave = async (networkId: string) => {
    const changed = edits[networkId];
    if (!changed || Object.keys(changed).length === 0) return;
    setSaving(networkId);
    setSaveErrors(prev => ({ ...prev, [networkId]: '' }));
    try {
      const res = await authFetch('/api/reconciliation/rules', {
        method: 'PATCH',
        body: JSON.stringify({ networkId, rules: changed }),
      });
      if (res.status === 429) { setSaveErrors(prev => ({ ...prev, [networkId]: 'Rate limit — try again.' })); return; }
      if (!res.ok) { setSaveErrors(prev => ({ ...prev, [networkId]: 'Save failed.' })); return; }
      setEdits(prev => { const next = { ...prev }; delete next[networkId]; return next; });
      fetchRules();
    } finally { setSaving(null); }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-500">
        <AlertCircle className="w-4 h-4" /> Failed to load validation rules.
        <button onClick={fetchRules} className="underline text-xs">Retry</button>
      </div>
    );
  }

  const fields = Object.keys(SYSTEM_DEFAULTS) as (keyof ValidationRules)[];

  return (
    <div className="space-y-4">
      {/* System defaults reference */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">System Defaults</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {fields.map(f => (
            <div key={f} className="text-xs">
              <span className="text-gray-500 dark:text-gray-400">{FIELD_LABELS[f]}: </span>
              <strong className="text-gray-900 dark:text-white">{String(SYSTEM_DEFAULTS[f])}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* Per-network rules */}
      <div className="space-y-2">
        {networkRules.map(net => {
          const isOpen = expanded.has(net.networkId);
          const netEdits = edits[net.networkId] ?? {};
          const hasEdits = Object.keys(netEdits).length > 0;

          return (
            <div key={net.networkId} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleExpand(net.networkId)}
                className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">{net.networkId}</span>
                {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
              </button>

              {isOpen && (
                <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-4 space-y-4 bg-white dark:bg-gray-900">
                  <div className="space-y-3">
                    {fields.map(field => {
                      const effectiveValue = net.rules[field] ?? SYSTEM_DEFAULTS[field];
                      const isDefault = net.rules[field] === undefined || net.rules[field] === null;
                      const currentEdit = netEdits[field];

                      return (
                        <div key={field} className="flex items-center gap-3">
                          <label className="text-xs text-gray-500 dark:text-gray-400 w-48 flex-shrink-0">
                            {FIELD_LABELS[field]}
                            {isDefault && !currentEdit && (
                              <span className="ml-1 text-gray-400 dark:text-gray-500">(using default)</span>
                            )}
                          </label>
                          {field === 'allowNullCountry' ? (
                            <select
                              value={String(currentEdit ?? effectiveValue)}
                              onChange={e => handleFieldChange(net.networkId, field, e.target.value)}
                              className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white w-24"
                            >
                              <option value="true">Yes</option>
                              <option value="false">No</option>
                            </select>
                          ) : (
                            <input
                              type="number"
                              value={String(currentEdit ?? effectiveValue)}
                              onChange={e => handleFieldChange(net.networkId, field, e.target.value)}
                              className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white w-28"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {saveErrors[net.networkId] && (
                    <p className="text-xs text-red-500">{saveErrors[net.networkId]}</p>
                  )}

                  <button
                    onClick={() => handleSave(net.networkId)}
                    disabled={!hasEdits || saving === net.networkId}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {saving === net.networkId && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Save Changes
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
