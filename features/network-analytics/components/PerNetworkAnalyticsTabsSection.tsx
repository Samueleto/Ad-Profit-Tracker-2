'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { getAuth } from 'firebase/auth';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { format } from 'date-fns';
import { ChevronDown, Loader2, RefreshCw, AlertCircle, Copy, Check } from 'lucide-react';
import { Toast } from '@/components/ui/Toast';
import GeoCountryDrilldownModal from '@/features/geo-breakdown/components/GeoCountryDrilldownModal';

const NETWORKS = ['exoclick', 'rollerads', 'zeydoo', 'propush'] as const;
type Network = typeof NETWORKS[number];

const NETWORK_LABELS: Record<Network, string> = {
  exoclick: 'ExoClick',
  rollerads: 'RollerAds',
  zeydoo: 'Zeydoo',
  propush: 'Propush',
};

const COST_NETWORKS: Network[] = ['exoclick'];
const PRIMARY_METRIC = (n: Network) => COST_NETWORKS.includes(n) ? 'cost' : 'revenue';
const AREA_COLOR = (n: Network) => COST_NETWORKS.includes(n) ? '#f59e0b' : '#22c55e';

interface NetworkStats {
  kpis: {
    primary: number | null;
    impressions: number | null;
    clicks: number | null;
    ctr: number | null;
    cpm: number | null;
  };
  dailySeries: Array<{ date: string; value: number | null }>;
  countries: Array<{
    countryCode: string;
    countryName: string;
    flagEmoji?: string;
    value: number | null;
    impressions: number | null;
    clicks: number | null;
    ctr: number | null;
    share: number;
  }>;
  lastSyncAt?: string | null;
  bestCountry?: string;
  worstCountry?: string;
  totalCountries?: number;
}

interface NetworkStatus {
  networkId: string;
  lastSyncStatus: 'success' | 'failed' | 'never' | null;
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

// ─── Raw API Explorer Tab ─────────────────────────────────────────────────────
const FIELD_MAPS: Record<Network, Array<{ api: string; app: string; type: string }>> = {
  exoclick: [
    { api: 'impressions', app: 'impressions', type: 'number' },
    { api: 'clicks', app: 'clicks', type: 'number' },
    { api: 'cost', app: 'cost', type: 'number' },
    { api: 'ctr', app: 'ctr', type: 'number' },
    { api: 'cpm', app: 'cpm', type: 'number' },
    { api: 'country_code', app: 'countryCode', type: 'string' },
  ],
  rollerads: [
    { api: 'revenue', app: 'revenue', type: 'number' },
    { api: 'impressions', app: 'impressions', type: 'number' },
    { api: 'clicks', app: 'clicks', type: 'number' },
    { api: 'country', app: 'countryCode', type: 'string' },
  ],
  zeydoo: [
    { api: 'revenue', app: 'revenue', type: 'number' },
    { api: 'impressions', app: 'impressions', type: 'number' },
    { api: 'clicks', app: 'clicks', type: 'number' },
    { api: 'geo', app: 'countryCode', type: 'string' },
  ],
  propush: [
    { api: 'revenue', app: 'revenue', type: 'number' },
    { api: 'impressions', app: 'impressions', type: 'number' },
    { api: 'clicks', app: 'clicks', type: 'number' },
    { api: 'country_code', app: 'countryCode', type: 'string' },
  ],
};

function NetworkAccordion({ networkId }: { networkId: Network }) {
  const [open, setOpen] = useState(false);
  const [rawData, setRawData] = useState<string | null>(null);
  const [rawLoading, setRawLoading] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sampleResult, setSampleResult] = useState<string | null>(null);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [noApiKey, setNoApiKey] = useState(false);

  const fetchRaw = useCallback(async () => {
    setRawLoading(true);
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const date = format(yesterday, 'yyyy-MM-dd');
      const res = await authFetch(`/api/networks/${networkId}/raw-response?date=${date}`);
      if (res.status === 404) { setNoApiKey(false); setRawData(null); return; }
      if (res.status === 403 || res.status === 401) { setNoApiKey(true); return; }
      if (!res.ok) { return; }
      const data = await res.json();
      if (data.noApiKey || data.error?.includes('key')) { setNoApiKey(true); return; }
      setRawData(JSON.stringify(data, null, 2));
      setFetchedAt(new Date().toLocaleTimeString());
    } finally { setRawLoading(false); }
  }, [networkId]);

  useEffect(() => {
    if (open && !rawData && !rawLoading) fetchRaw();
  }, [open, rawData, rawLoading, fetchRaw]);

  const handleCopy = () => {
    if (rawData) {
      navigator.clipboard.writeText(rawData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleFetchSample = async () => {
    setSampleLoading(true);
    try {
      const res = await authFetch('/api/networks/config/test-connection', {
        method: 'POST',
        body: JSON.stringify({ networkId }),
      });
      const data = await res.json();
      setSampleResult(JSON.stringify(data, null, 2));
    } finally { setSampleLoading(false); }
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
        <span className="text-sm font-medium text-gray-900 dark:text-white">{NETWORK_LABELS[networkId]}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-gray-100 dark:border-gray-800 p-4 space-y-4 bg-white dark:bg-gray-900">
          {/* Endpoint info */}
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Endpoint</p>
            <code className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
              GET /api/networks/{networkId}/raw-response?date=YYYY-MM-DD
            </code>
          </div>

          {/* Field mapping */}
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Field Mapping</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-400">
                  <th className="pb-1 pr-4">API Field</th>
                  <th className="pb-1 pr-4">App Field</th>
                  <th className="pb-1">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {FIELD_MAPS[networkId].map(f => (
                  <tr key={f.api}>
                    <td className="py-1 pr-4 font-mono text-gray-700 dark:text-gray-300">{f.api}</td>
                    <td className="py-1 pr-4 font-mono text-blue-600 dark:text-blue-400">{f.app}</td>
                    <td className="py-1 text-gray-500">{f.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Raw response */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Last Response {fetchedAt && <span className="text-gray-400">· {fetchedAt}</span>}
              </p>
              <div className="flex gap-2">
                {rawData && (
                  <button onClick={handleCopy}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
                    {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                )}
                <button onClick={fetchRaw} className="text-xs text-gray-400 hover:text-gray-600">
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>
            </div>

            {noApiKey ? (
              <div className="text-xs text-amber-600 dark:text-amber-400">
                API key not configured —{' '}
                <Link href="/settings" className="underline">go to Settings</Link>
              </div>
            ) : rawLoading ? (
              <div className="animate-pulse h-24 bg-gray-100 dark:bg-gray-800 rounded" />
            ) : rawData ? (
              <pre className="text-xs font-mono bg-gray-100 dark:bg-gray-900 rounded-lg p-3 overflow-auto max-h-48 text-gray-700 dark:text-gray-300">
                {rawData}
              </pre>
            ) : (
              <p className="text-xs text-gray-400">No data available — try syncing first.</p>
            )}
          </div>

          {/* Fetch fresh sample */}
          <div>
            <button onClick={handleFetchSample} disabled={sampleLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors">
              {sampleLoading && <Loader2 className="w-3 h-3 animate-spin" />}
              Fetch Fresh Sample
            </button>
            {sampleResult && (
              <pre className="mt-2 text-xs font-mono bg-gray-100 dark:bg-gray-900 rounded-lg p-3 overflow-auto max-h-40 text-gray-700 dark:text-gray-300">
                {sampleResult}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ApiExplorerTab() {
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Inspect raw API responses and field mappings for each network.
      </p>
      {NETWORKS.map(n => <NetworkAccordion key={n} networkId={n} />)}
    </div>
  );
}

// ─── Per-network tab content ──────────────────────────────────────────────────
function NetworkTabPanel({
  networkId,
  dateFrom,
  dateTo,
  onCountryClick,
}: {
  networkId: Network;
  dateFrom: string;
  dateTo: string;
  onCountryClick?: (countryCode: string, countryName: string, flagEmoji: string) => void;
}) {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);

  const fetchStats = useCallback(async () => {
    if (!dateFrom || !dateTo) return;
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams({ networkId, dateFrom, dateTo });
      const res = await authFetch(`/api/networks/stats?${params}`);
      if (!res.ok) { setError(true); return; }
      const data = await res.json();
      setStats(data);
    } catch { setError(true); }
    finally { setLoading(false); }
  }, [networkId, dateFrom, dateTo]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncToast(null);
    try {
      const res = await authFetch('/api/sync/manual', {
        method: 'POST',
        body: JSON.stringify({ networkId }),
      });
      if (res.ok) {
        setSyncToast({ message: `${NETWORK_LABELS[networkId]} synced successfully.`, variant: 'success' });
        fetchStats();
      } else {
        const data = await res.json().catch(() => ({}));
        setSyncToast({ message: data.error ?? 'Sync failed — please try again.', variant: 'error' });
      }
    } catch {
      setSyncToast({ message: 'Sync failed — please try again.', variant: 'error' });
    } finally { setSyncing(false); }
  };

  const primary = PRIMARY_METRIC(networkId);
  const areaColor = AREA_COLOR(networkId);
  const fmt = (v: number | null) => v != null ? `$${v.toFixed(4)}` : '—';

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-500 py-6">
        <AlertCircle className="w-4 h-4" /> Failed to load {NETWORK_LABELS[networkId]} data.
        <button onClick={fetchStats} className="underline text-xs">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {syncToast && (
        <Toast message={syncToast.message} variant={syncToast.variant} onClose={() => setSyncToast(null)} />
      )}
      {/* Sync button */}
      <div className="flex justify-end">
        <button onClick={handleSync} disabled={syncing || loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors">
          {syncing ? <><Loader2 className="w-3 h-3 animate-spin" /> Syncing…</> : <><RefreshCw className="w-3 h-3" /> Sync This Network</>}
        </button>
      </div>

      {/* KPI row */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl" />)}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: primary === 'cost' ? 'Cost' : 'Revenue', value: fmt(stats.kpis.primary) },
            { label: 'Impressions', value: stats.kpis.impressions != null ? stats.kpis.impressions.toLocaleString() : '—' },
            { label: 'Clicks', value: stats.kpis.clicks != null ? stats.kpis.clicks.toLocaleString() : '—' },
            { label: 'CTR', value: stats.kpis.ctr != null ? `${stats.kpis.ctr.toFixed(2)}%` : '—' },
            { label: 'CPM', value: fmt(stats.kpis.cpm) },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
              <p className="text-base font-bold text-gray-900 dark:text-white mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {/* Daily chart */}
      {loading ? (
        <div className="h-[280px] animate-pulse bg-gray-100 dark:bg-gray-800 rounded-xl" />
      ) : stats?.dailySeries?.length ? (
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.dailySeries} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`fill-${networkId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={areaColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={areaColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 10 }}
                tickFormatter={v => { try { return format(new Date(v), 'MMM d'); } catch { return v; } }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => [`$${Number(v).toFixed(4)}`, primary]} />
              <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="4 2" />
              <Area type="monotone" dataKey="value" stroke={areaColor} fill={`url(#fill-${networkId})`}
                strokeWidth={2} dot={false} connectNulls={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : !loading ? (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">No daily data for this period.</p>
      ) : null}

      {/* GEO table */}
      {loading ? (
        <div className="animate-pulse space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-8 bg-gray-100 dark:bg-gray-800 rounded" />)}
        </div>
      ) : stats?.countries?.length ? (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                {['Country', primary === 'cost' ? 'Cost' : 'Revenue', 'Impressions', 'Clicks', 'CTR', 'Share'].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {stats.countries.map(row => (
                <tr
                  key={row.countryCode}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${onCountryClick ? 'cursor-pointer' : ''}`}
                  onClick={onCountryClick ? () => onCountryClick(row.countryCode, row.countryName || row.countryCode, row.flagEmoji || '') : undefined}
                >
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                    {row.flagEmoji && <span className="mr-1">{row.flagEmoji}</span>}
                    {row.countryName || row.countryCode}
                  </td>
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{row.value != null ? `$${row.value.toFixed(4)}` : '—'}</td>
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{row.impressions != null ? row.impressions.toLocaleString() : '—'}</td>
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{row.clicks != null ? row.clicks.toLocaleString() : '—'}</td>
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{row.ctr != null ? `${row.ctr.toFixed(2)}%` : '—'}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(row.share, 100)}%`, backgroundColor: areaColor }} />
                      </div>
                      <span className="text-gray-500">{row.share.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Insights strip */}
      {stats && (
        <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
          <button onClick={() => setInsightsOpen(p => !p)}
            className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${insightsOpen ? 'rotate-180' : ''}`} />
            Network Insights
          </button>
          {insightsOpen && (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <p className="text-gray-400 mb-0.5">Best Country</p>
                <p className="font-semibold text-gray-900 dark:text-white">{stats.bestCountry ?? '—'}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-0.5">Worst Country</p>
                <p className="font-semibold text-gray-900 dark:text-white">{stats.worstCountry ?? '—'}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-0.5">Countries Tracked</p>
                <p className="font-semibold text-gray-900 dark:text-white">{stats.totalCountries ?? stats.countries?.length ?? '—'}</p>
              </div>
              <div>
                <p className="text-gray-400 mb-0.5">Last Sync</p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {stats.lastSyncAt ? format(new Date(stats.lastSyncAt), 'MMM d, HH:mm') : '—'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main section ─────────────────────────────────────────────────────────────
interface PerNetworkAnalyticsTabsSectionProps {
  dateFrom: string;
  dateTo: string;
}

type TabId = Network | 'explorer';

export default function PerNetworkAnalyticsTabsSection({ dateFrom, dateTo }: PerNetworkAnalyticsTabsSectionProps) {
  const [activeTab, setActiveTab] = useState<TabId>('exoclick');
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [drilldown, setDrilldown] = useState<{ code: string; name: string; flag: string } | null>(null);

  useEffect(() => {
    authFetch('/api/networks/stats?summary=true')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.networks) {
          const map: Record<string, string> = {};
          for (const n of (data.networks as NetworkStatus[])) {
            map[n.networkId] = n.lastSyncStatus ?? 'never';
          }
          setStatuses(map);
        }
      })
      .catch(() => {});
  }, []);

  const statusDot = (networkId: Network) => {
    const s = statuses[networkId];
    if (s === 'success') return 'bg-green-500';
    if (s === 'failed') return 'bg-red-500';
    return 'bg-gray-400';
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">Per-Network Analytics</h3>

      {/* Tab bar */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-5">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {NETWORKS.map(n => (
            <button key={n} onClick={() => setActiveTab(n)}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === n
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`}>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot(n)}`} />
              {NETWORK_LABELS[n]}
            </button>
          ))}
          <button onClick={() => setActiveTab('explorer')}
            className={`px-4 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === 'explorer'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
            }`}>
            API Explorer
          </button>
        </nav>
      </div>

      {activeTab === 'explorer' ? (
        <ApiExplorerTab />
      ) : (
        <NetworkTabPanel
          key={`${activeTab}-${dateFrom}-${dateTo}`}
          networkId={activeTab as Network}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onCountryClick={(code, name, flag) => setDrilldown({ code, name, flag })}
        />
      )}

      {/* Geo country drilldown modal */}
      {drilldown && (
        <GeoCountryDrilldownModal
          countryCode={drilldown.code}
          countryName={drilldown.name}
          flagEmoji={drilldown.flag}
          onClose={() => setDrilldown(null)}
        />
      )}
    </div>
  );
}
