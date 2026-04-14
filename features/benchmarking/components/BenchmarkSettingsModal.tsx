'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth } from 'firebase/auth';
import { X, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

type BenchMetric = 'roi' | 'ctr' | 'cpm' | 'revenue' | 'cost' | 'impressions' | 'clicks';

interface MetricConfig {
  metric: BenchMetric;
  label: string;
  unit: string;
  systemDefault: number;
  maxValue?: number;
}

const METRIC_CONFIGS: MetricConfig[] = [
  { metric: 'roi',         label: 'ROI %',       unit: '%',  systemDefault: 150, maxValue: 10000 },
  { metric: 'ctr',         label: 'CTR %',       unit: '%',  systemDefault: 0.5, maxValue: 10000 },
  { metric: 'cpm',         label: 'CPM',          unit: '$',  systemDefault: 2.5, maxValue: 1000 },
  { metric: 'revenue',     label: 'Revenue',      unit: '$',  systemDefault: 1000 },
  { metric: 'cost',        label: 'Cost',         unit: '$',  systemDefault: 500 },
  { metric: 'impressions', label: 'Impressions',  unit: '',   systemDefault: 100000 },
  { metric: 'clicks',      label: 'Clicks',       unit: '',   systemDefault: 500 },
];

interface MetricSetting {
  useIndustryDefault: boolean;
  customTarget: number | null;
}

interface SettingsState {
  [key: string]: MetricSetting;
}

async function authFetch(path: string, init: RequestInit = {}, refresh = false): Promise<Response> {
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken(refresh);
  return fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

interface BenchmarkSettingsModalProps {
  onClose: () => void;
  onSaved: () => void;
}

export default function BenchmarkSettingsModal({ onClose, onSaved }: BenchmarkSettingsModalProps) {
  const router = useRouter();
  const [settings, setSettings] = useState<SettingsState>(() => {
    const init: SettingsState = {};
    METRIC_CONFIGS.forEach(c => {
      init[c.metric] = { useIndustryDefault: true, customTarget: null };
    });
    return init;
  });
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        let res = await authFetch('/api/benchmarks/settings');
        if (res.status === 401) {
          res = await authFetch('/api/benchmarks/settings', {}, true);
          if (res.status === 401) {
            toast.error('Session expired. Please sign in again.');
            router.replace('/');
            return;
          }
        }
        const data = res.ok ? await res.json() : null;
        if (data) {
          const next: SettingsState = {};
          const nextInputs: Record<string, string> = {};
          METRIC_CONFIGS.forEach(c => {
            const saved = data[c.metric];
            const useDefault = saved?.useIndustryDefault ?? true;
            const custom = saved?.customTarget ?? null;
            next[c.metric] = { useIndustryDefault: useDefault, customTarget: custom };
            nextInputs[c.metric] = custom !== null ? String(custom) : '';
          });
          setSettings(next);
          setInputValues(nextInputs);
          if (data.updatedAt) setLastUpdated(data.updatedAt);
        }
      } catch { /* ignore load errors */ }
      finally { setLoading(false); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function validate(metric: BenchMetric, value: string): string | null {
    const num = Number(value);
    if (value === '') return null;
    if (isNaN(num) || num < 0) return 'Must be a non-negative number';
    const cfg = METRIC_CONFIGS.find(c => c.metric === metric)!;
    if (cfg.maxValue !== undefined && num > cfg.maxValue) return `Max is ${cfg.maxValue}`;
    return null;
  }

  function handleInputChange(metric: BenchMetric, value: string) {
    setInputValues(prev => ({ ...prev, [metric]: value }));
    const err = validate(metric, value);
    setValidationErrors(prev => ({ ...prev, [metric]: err ?? '' }));
    const num = value === '' ? null : Number(value);
    setSettings(prev => ({ ...prev, [metric]: { ...prev[metric], customTarget: isNaN(num as number) ? null : num } }));
  }

  function toggleUseDefault(metric: BenchMetric) {
    setSettings(prev => ({
      ...prev,
      [metric]: { ...prev[metric], useIndustryDefault: !prev[metric].useIndustryDefault },
    }));
  }

  function resetRow(metric: BenchMetric) {
    setSettings(prev => ({ ...prev, [metric]: { useIndustryDefault: true, customTarget: null } }));
    setInputValues(prev => ({ ...prev, [metric]: '' }));
    setValidationErrors(prev => ({ ...prev, [metric]: '' }));
  }

  function resetAll() {
    const next: SettingsState = {};
    const nextInputs: Record<string, string> = {};
    METRIC_CONFIGS.forEach(c => {
      next[c.metric] = { useIndustryDefault: true, customTarget: null };
      nextInputs[c.metric] = '';
    });
    setSettings(next);
    setInputValues(nextInputs);
    setValidationErrors({});
  }

  async function handleSave() {
    const hasErrors = Object.values(validationErrors).some(e => e);
    if (hasErrors) return;
    setSaving(true);
    const body: Record<string, unknown> = {};
    METRIC_CONFIGS.forEach(c => { body[c.metric] = settings[c.metric]; });
    const saveInit = { method: 'PATCH', body: JSON.stringify(body) };
    try {
      let res = await authFetch('/api/benchmarks/settings', saveInit);
      if (res.status === 401) {
        res = await authFetch('/api/benchmarks/settings', saveInit, true);
        if (res.status === 401) {
          toast.error('Session expired. Please sign in again.');
          router.replace('/');
          return;
        }
      }
      if (res.ok) {
        toast.success('Settings saved');
        setLastUpdated(new Date().toISOString());
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Benchmark Settings</h2>
            {lastUpdated && (
              <p className="text-xs text-gray-400 mt-0.5">
                Last updated {formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loading ? (
            <div className="space-y-3">
              {METRIC_CONFIGS.map(c => (
                <div key={c.metric} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            METRIC_CONFIGS.map(cfg => {
              const s = settings[cfg.metric];
              const inputVal = inputValues[cfg.metric] ?? '';
              const err = validationErrors[cfg.metric];
              const dimmed = s.useIndustryDefault;
              return (
                <div key={cfg.metric} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{cfg.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Default: {cfg.unit}{cfg.systemDefault.toLocaleString()}</span>
                      <button
                        onClick={() => resetRow(cfg.metric)}
                        disabled={saving}
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                        title="Reset to default"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleUseDefault(cfg.metric)}
                      disabled={saving}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors whitespace-nowrap ${
                        s.useIndustryDefault
                          ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400'
                          : 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {s.useIndustryDefault ? 'Industry Default' : 'Custom Target'}
                    </button>
                    <input
                      type="number"
                      min={0}
                      max={cfg.maxValue}
                      value={inputVal}
                      onChange={e => handleInputChange(cfg.metric, e.target.value)}
                      disabled={dimmed || saving}
                      placeholder={dimmed ? String(cfg.systemDefault) : 'Enter target'}
                      className={`flex-1 min-w-0 text-sm px-2.5 py-1 rounded-lg border transition-colors ${
                        dimmed
                          ? 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600'
                          : err
                          ? 'border-red-400 bg-red-50 dark:bg-red-900/10'
                          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                      }`}
                    />
                    {cfg.unit && <span className="text-xs text-gray-400 shrink-0">{cfg.unit}</span>}
                  </div>
                  {err && <p className="text-xs text-red-500 mt-1">{err}</p>}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-200 dark:border-gray-700 gap-3">
          <button
            onClick={resetAll}
            disabled={saving || loading}
            className="text-sm text-red-500 hover:text-red-600 font-medium transition-colors disabled:opacity-50"
          >
            Reset All
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading || Object.values(validationErrors).some(e => e)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save All
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
