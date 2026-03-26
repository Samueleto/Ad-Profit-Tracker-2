'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { getAuth } from 'firebase/auth';
import { ChevronDown, Loader2, RefreshCw, Copy, Check, AlertCircle, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// Dynamically import react-json-view (client-only)
const ReactJson = dynamic(() => import('react-json-view'), { ssr: false });

// ─── Network definitions ──────────────────────────────────────────────────────

const NETWORKS = ['exoclick', 'rollerads', 'zeydoo', 'propush'] as const;
type Network = typeof NETWORKS[number];

const NETWORK_META: Record<Network, {
  label: string;
  endpoint: string;
  method: string;
  params: Array<{ name: string; required: boolean; description: string }>;
  fieldMap: Array<{ api: string; internal: string }>;
}> = {
  exoclick: {
    label: 'ExoClick',
    endpoint: '/api/networks/exoclick/raw-response',
    method: 'GET',
    params: [
      { name: 'dateFrom', required: true, description: 'Start date (YYYY-MM-DD)' },
      { name: 'dateTo', required: true, description: 'End date (YYYY-MM-DD)' },
    ],
    fieldMap: [
      { api: 'impressions', internal: 'adStats.impressions' },
      { api: 'clicks', internal: 'adStats.clicks' },
      { api: 'cost', internal: 'adStats.cost' },
      { api: 'ctr', internal: 'adStats.ctr' },
      { api: 'cpm', internal: 'adStats.cpm' },
      { api: 'country_code', internal: 'adStats.countryCode' },
      { api: 'date', internal: 'adStats.date' },
    ],
  },
  rollerads: {
    label: 'RollerAds',
    endpoint: '/api/networks/rollerads/raw-response',
    method: 'GET',
    params: [
      { name: 'dateFrom', required: true, description: 'Start date (YYYY-MM-DD)' },
      { name: 'dateTo', required: true, description: 'End date (YYYY-MM-DD)' },
    ],
    fieldMap: [
      { api: 'revenue', internal: 'adStats.revenue' },
      { api: 'impressions', internal: 'adStats.impressions' },
      { api: 'clicks', internal: 'adStats.clicks' },
      { api: 'country', internal: 'adStats.countryCode' },
      { api: 'date', internal: 'adStats.date' },
    ],
  },
  zeydoo: {
    label: 'Zeydoo',
    endpoint: '/api/networks/zeydoo/raw-response',
    method: 'GET',
    params: [
      { name: 'dateFrom', required: true, description: 'Start date (YYYY-MM-DD)' },
      { name: 'dateTo', required: true, description: 'End date (YYYY-MM-DD)' },
    ],
    fieldMap: [
      { api: 'revenue', internal: 'adStats.revenue' },
      { api: 'leads', internal: 'adStats.clicks' },
      { api: 'geo', internal: 'adStats.countryCode' },
      { api: 'epc', internal: 'adStats.epc' },
      { api: 'date', internal: 'adStats.date' },
    ],
  },
  propush: {
    label: 'Propush',
    endpoint: '/api/networks/propush/raw-response',
    method: 'GET',
    params: [
      { name: 'dateFrom', required: true, description: 'Start date (YYYY-MM-DD)' },
      { name: 'dateTo', required: true, description: 'End date (YYYY-MM-DD)' },
    ],
    fieldMap: [
      { api: 'revenue', internal: 'adStats.revenue' },
      { api: 'impressions', internal: 'adStats.impressions' },
      { api: 'clicks', internal: 'adStats.clicks' },
      { api: 'ctr', internal: 'adStats.ctr' },
      { api: 'country_code', internal: 'adStats.countryCode' },
      { api: 'date', internal: 'adStats.date' },
    ],
  },
};

// ─── Auth fetch ───────────────────────────────────────────────────────────────

async function authFetch(path: string): Promise<Response> {
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken();
  return fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

// ─── Accordion ────────────────────────────────────────────────────────────────

interface AccordionState {
  open: boolean;
  loading: boolean;
  fetching: boolean;
  response: Record<string, unknown> | null;
  error: string | null;
  noApiKey: boolean;
  noCached: boolean;
  lastFetchedAt: string | null;
  copied: boolean;
}

function NetworkAccordion({ network }: { network: Network }) {
  const meta = NETWORK_META[network];
  const [state, setState] = useState<AccordionState>({
    open: false,
    loading: false,
    fetching: false,
    response: null,
    error: null,
    noApiKey: false,
    noCached: false,
    lastFetchedAt: null,
    copied: false,
  });

  const loadCached = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null, noApiKey: false, noCached: false }));
    try {
      const res = await authFetch(meta.endpoint);
      if (res.status === 401 || res.status === 403) {
        setState(s => ({ ...s, loading: false, noApiKey: true }));
        return;
      }
      if (res.status === 404) {
        setState(s => ({ ...s, loading: false, noCached: true }));
        return;
      }
      if (!res.ok) {
        const msg = await res.text().catch(() => 'Unknown error');
        setState(s => ({ ...s, loading: false, error: msg }));
        return;
      }
      const data = await res.json();
      // Check for no-api-key signal in response body
      if (data?.error === 'no_api_key' || data?.notConfigured) {
        setState(s => ({ ...s, loading: false, noApiKey: true }));
        return;
      }
      setState(s => ({
        ...s,
        loading: false,
        response: data,
        lastFetchedAt: new Date().toISOString(),
        noCached: false,
      }));
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: String(err) }));
    }
  }, [meta.endpoint]);

  async function toggle() {
    const nowOpen = !state.open;
    setState(s => ({ ...s, open: nowOpen }));
    if (nowOpen && !state.response && !state.loading && !state.noCached && !state.noApiKey) {
      loadCached();
    }
  }

  async function fetchFresh() {
    setState(s => ({ ...s, fetching: true, error: null }));
    try {
      const res = await authFetch(`/api/networks/config/test-connection?network=${network}`);
      if (!res.ok) {
        const msg = await res.text().catch(() => 'Test connection failed');
        setState(s => ({ ...s, fetching: false, error: msg }));
        return;
      }
      const data = await res.json();
      setState(s => ({
        ...s,
        fetching: false,
        response: data,
        lastFetchedAt: new Date().toISOString(),
        noCached: false,
        error: null,
      }));
    } catch (err) {
      setState(s => ({ ...s, fetching: false, error: String(err) }));
    }
  }

  function copyJson() {
    if (!state.response) return;
    navigator.clipboard.writeText(JSON.stringify(state.response, null, 2))
      .then(() => {
        setState(s => ({ ...s, copied: true }));
        setTimeout(() => setState(s => ({ ...s, copied: false })), 2000);
      });
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{meta.label}</span>
          <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded">
            {meta.method} {meta.endpoint}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${state.open ? 'rotate-180' : ''}`} />
      </button>

      {/* Body */}
      {state.open && (
        <div className="border-t border-gray-100 dark:border-gray-800 p-4 space-y-4 bg-white dark:bg-gray-900">
          {/* Parameters */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Required Parameters</h4>
            <div className="space-y-1">
              {meta.params.map(p => (
                <div key={p.name} className="flex items-center gap-2 text-xs">
                  <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-blue-600 dark:text-blue-400">{p.name}</code>
                  {p.required && <span className="text-red-400 font-medium">required</span>}
                  <span className="text-gray-500 dark:text-gray-400">{p.description}</span>
                </div>
              ))}
            </div>
          </div>

          {/* JSON Viewer */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Response</h4>
              <div className="flex items-center gap-2">
                {state.lastFetchedAt && (
                  <span className="text-xs text-gray-400">
                    Last fetched {formatDistanceToNow(new Date(state.lastFetchedAt), { addSuffix: true })}
                  </span>
                )}
                {state.response && (
                  <button
                    onClick={copyJson}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-1 border border-gray-200 dark:border-gray-700 rounded transition-colors"
                  >
                    {state.copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                    {state.copied ? 'Copied!' : 'Copy JSON'}
                  </button>
                )}
                <button
                  onClick={fetchFresh}
                  disabled={state.fetching || state.noApiKey}
                  className="flex items-center gap-1 text-xs bg-blue-600 text-white px-2.5 py-1 rounded hover:bg-blue-700 disabled:opacity-60 transition-colors"
                >
                  {state.fetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Fetch Fresh Sample
                </button>
              </div>
            </div>

            {/* States */}
            {state.loading && (
              <div className="space-y-2">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" style={{ width: `${60 + i * 7}%` }} />
                ))}
              </div>
            )}
            {!state.loading && state.noApiKey && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>API key not configured for {meta.label}.</span>
                <a href="/settings" className="flex items-center gap-1 underline font-medium hover:no-underline">
                  Configure in Settings <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
            {!state.loading && !state.noApiKey && state.noCached && !state.response && (
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-500 dark:text-gray-400">
                No response cached yet. Click <strong>Fetch Fresh Sample</strong> to retrieve one.
              </div>
            )}
            {!state.loading && state.error && (
              <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                <span>{state.error}</span>
                <button onClick={loadCached} className="ml-3 text-xs underline shrink-0">Retry</button>
              </div>
            )}
            {!state.loading && !state.noApiKey && state.response && (
              <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto bg-gray-50 dark:bg-gray-950 p-3 text-xs font-mono">
                <ReactJson
                  src={state.response}
                  theme="monokai"
                  displayDataTypes={false}
                  enableClipboard={false}
                  name={null}
                  collapsed={1}
                  style={{ background: 'transparent', fontSize: '12px' }}
                />
              </div>
            )}
          </div>

          {/* Field mapping table */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Field Mapping</h4>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-500 dark:text-gray-400">Raw API Field</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500 dark:text-gray-400">Internal adStats Field</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                  {meta.fieldMap.map(f => (
                    <tr key={f.api}>
                      <td className="px-3 py-1.5 font-mono text-blue-600 dark:text-blue-400">{f.api}</td>
                      <td className="px-3 py-1.5 font-mono text-gray-600 dark:text-gray-400">{f.internal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main API Explorer tab ────────────────────────────────────────────────────

export default function ApiExplorerTab() {
  return (
    <div className="space-y-4">
      <div className="mb-2">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">API Response Explorer</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Inspect raw API responses from each ad network, view field mappings, and test live connections.
        </p>
      </div>
      {NETWORKS.map(n => (
        <NetworkAccordion key={n} network={n} />
      ))}
    </div>
  );
}
