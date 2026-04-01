'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import { Filter, X, Loader2, AlertTriangle, ChevronDown, Search, Bookmark, Trash2, Plus } from 'lucide-react';
import { useDashboardStore, type MetricFocus, type DataQuality } from '@/store/dashboardStore';

// ─── Constants ────────────────────────────────────────────────────────────────

const NETWORKS = [
  { id: 'exoclick', label: 'ExoClick' },
  { id: 'rollerads', label: 'RollerAds' },
  { id: 'zeydoo', label: 'Zeydoo' },
  { id: 'propush', label: 'Propush' },
] as const;

const METRICS: { id: MetricFocus; label: string }[] = [
  { id: 'revenue', label: 'Revenue' },
  { id: 'cost', label: 'Cost' },
  { id: 'profit', label: 'Profit' },
  { id: 'roi', label: 'ROI' },
];

const QUALITY_OPTIONS: { id: DataQuality; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'anomalies', label: 'Anomalies Only' },
  { id: 'clean', label: 'Clean Only' },
];

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

// ─── Country combobox ─────────────────────────────────────────────────────────

interface Country { code: string; name: string; }

function CountryCombobox({
  selected,
  onChange,
  dateFrom,
  dateTo,
}: {
  selected: string[];
  onChange: (codes: string[]) => void;
  dateFrom: string;
  dateTo: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [countries, setCountries] = useState<Country[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'empty' | 'error'>('idle');
  const ref = useRef<HTMLDivElement>(null);

  const loadCountries = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await authFetch(`/api/filters/options?type=country&dateFrom=${dateFrom}&dateTo=${dateTo}`);
      if (!res.ok) { setStatus('error'); return; }
      const data = await res.json();
      const list: Country[] = data?.countries ?? data ?? [];
      setCountries(list);
      setStatus(list.length === 0 ? 'empty' : 'idle');
    } catch {
      setStatus('error');
    }
  }, [dateFrom, dateTo]);

  // Invalidate cached country list when date range changes
  useEffect(() => {
    setCountries([]);
    setStatus('idle');
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (open && countries.length === 0 && status === 'idle') {
      loadCountries();
    }
  }, [open, countries.length, status, loadCountries]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = countries.filter(c =>
    query === '' || c.name.toLowerCase().includes(query.toLowerCase()) || c.code.toLowerCase().includes(query.toLowerCase())
  );

  function toggle(code: string) {
    onChange(selected.includes(code) ? selected.filter(c => c !== code) : [...selected, code]);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs border rounded-lg transition-colors ${
          selected.length > 0
            ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
        }`}
      >
        GEO {selected.length > 0 && <span className="bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">{selected.length}</span>}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 z-40 w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
          <div className="p-2 border-b border-gray-100 dark:border-gray-800">
            <input
              type="text"
              placeholder="Search countries..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full text-xs px-2 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-400"
            />
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            {status === 'loading' && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-400">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading countries...
              </div>
            )}
            {status === 'error' && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-amber-500">
                <AlertTriangle className="w-3 h-3" />
                Could not load countries.{' '}
                <button onClick={loadCountries} className="underline">Retry</button>
              </div>
            )}
            {status === 'empty' && (
              <div className="px-3 py-2 text-xs text-gray-400">No countries found for this date range</div>
            )}
            {status === 'idle' && filtered.map(c => (
              <label key={c.code} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.includes(c.code)}
                  onChange={() => toggle(c.code)}
                  className="rounded border-gray-300 text-blue-600"
                />
                <span className="text-xs text-gray-700 dark:text-gray-300">{c.name} ({c.code})</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Saved Filters / Preset Dropdown ─────────────────────────────────────────

interface SavedFilter {
  id: string;
  name: string;
  filters: {
    selectedNetworks?: string[];
    selectedCountries?: string[];
    selectedMetric?: MetricFocus;
    dataQuality?: DataQuality;
  };
}

function SavedFiltersDropdown({
  currentFilters,
  onApply,
}: {
  currentFilters: { selectedNetworks: string[]; selectedCountries: string[]; selectedMetric: MetricFocus; dataQuality: DataQuality };
  onApply: (f: SavedFilter['filters']) => void;
}) {
  const [open, setOpen] = useState(false);
  const [presets, setPresets] = useState<SavedFilter[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveMode, setSaveMode] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const loadPresets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/filters/saved');
      if (res.ok) {
        const data = await res.json();
        setPresets(data.filters ?? []);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPresets(); }, [loadPresets]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSaveMode(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleSave() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      const saveRes = await fetch('/api/filters/saved', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name: newName.trim(), filters: currentFilters }),
      });
      if (saveRes.ok) {
        setNewName('');
        setSaveMode(false);
        await loadPresets();
      }
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const auth = getAuth();
    const token = await auth.currentUser?.getIdToken();
    try {
      await fetch(`/api/filters/saved/${id}`, {
        method: 'DELETE',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      setPresets(prev => prev.filter(p => p.id !== id));
    } catch { /* ignore */ }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <Bookmark className="w-3 h-3" />
        Saved
        {presets.length > 0 && (
          <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full px-1.5 text-[10px] font-medium">
            {presets.length}
          </span>
        )}
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <div className="absolute top-full mt-1 right-0 z-40 w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg">
          <div className="p-2 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Saved Filters</span>
            <button
              onClick={() => { setSaveMode(s => !s); setNewName(''); }}
              className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              <Plus className="w-3 h-3" />
              Save current
            </button>
          </div>

          {saveMode && (
            <div className="p-2 border-b border-gray-100 dark:border-gray-800 flex items-center gap-1.5">
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                placeholder="Filter name..."
                autoFocus
                className="flex-1 text-xs px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-400"
              />
              <button
                onClick={handleSave}
                disabled={saving || !newName.trim()}
                className="px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded-md disabled:opacity-50 hover:bg-blue-700 transition-colors"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
              </button>
            </div>
          )}

          <div className="max-h-48 overflow-y-auto py-1">
            {loading && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-400">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading...
              </div>
            )}
            {!loading && presets.length === 0 && (
              <div className="px-3 py-2 text-xs text-gray-400">No saved filters yet</div>
            )}
            {presets.map(preset => (
              <div key={preset.id} className="flex items-center justify-between px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 group">
                <button
                  onClick={() => { onApply(preset.filters); setOpen(false); }}
                  className="flex-1 text-left text-xs text-gray-700 dark:text-gray-300 truncate"
                >
                  {preset.name}
                </button>
                <button
                  onClick={() => handleDelete(preset.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Filter panel (shared between desktop + mobile sheet) ────────────────────

interface FilterPanelProps {
  stagedNetworks: string[];
  setStagedNetworks: (n: string[]) => void;
  stagedCountries: string[];
  setStagedCountries: (c: string[]) => void;
  metric: MetricFocus;
  setMetricImmediate: (m: MetricFocus) => void;
  quality: DataQuality;
  setQualityImmediate: (q: DataQuality) => void;
  search: string;
  setSearchImmediate: (s: string) => void;
  dateFrom: string;
  dateTo: string;
  onApply: () => void;
  onClear: () => void;
}

function FilterPanel({
  stagedNetworks, setStagedNetworks,
  stagedCountries, setStagedCountries,
  metric, setMetricImmediate,
  quality, setQualityImmediate,
  search, setSearchImmediate,
  dateFrom, dateTo,
  onApply, onClear,
}: FilterPanelProps) {
  const allSelected = NETWORKS.every(n => stagedNetworks.includes(n.id));

  function toggleAll() {
    setStagedNetworks(allSelected ? [] : NETWORKS.map(n => n.id));
  }

  function toggleNetwork(id: string) {
    setStagedNetworks(stagedNetworks.includes(id) ? stagedNetworks.filter(n => n !== id) : [...stagedNetworks, id]);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Networks */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <label className="flex items-center gap-1 text-xs cursor-pointer text-gray-600 dark:text-gray-400">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded border-gray-300 text-blue-600" />
          All
        </label>
        {NETWORKS.map(n => (
          <label key={n.id} className="flex items-center gap-1 text-xs cursor-pointer text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={stagedNetworks.includes(n.id)}
              onChange={() => toggleNetwork(n.id)}
              className="rounded border-gray-300 text-blue-600"
            />
            {n.label}
          </label>
        ))}
      </div>

      <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 hidden sm:block" />

      {/* Country combobox */}
      <CountryCombobox
        selected={stagedCountries}
        onChange={setStagedCountries}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />

      <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 hidden sm:block" />

      {/* Metric pills */}
      <div className="flex gap-0.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 p-0.5">
        {METRICS.map(m => (
          <button
            key={m.id}
            onClick={() => setMetricImmediate(m.id)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              metric === m.id
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 hidden sm:block" />

      {/* Data quality toggle */}
      <div className="flex gap-0.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 p-0.5">
        {QUALITY_OPTIONS.map(q => (
          <button
            key={q.id}
            onClick={() => setQualityImmediate(q.id)}
            className={`px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              quality === q.id
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {q.label}
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 hidden sm:block" />

      {/* Free-text search */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearchImmediate(e.target.value)}
          placeholder="Search..."
          className="pl-6 pr-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-400 w-36"
        />
      </div>

      {/* Apply / Clear */}
      <button
        onClick={onApply}
        className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Apply Filters
      </button>
      <button
        onClick={onClear}
        className="px-2.5 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        Clear All
      </button>
    </div>
  );
}

// ─── Main FilterToolbar ───────────────────────────────────────────────────────

export default function FilterToolbar({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const {
    filters,
    setSelectedNetworks,
    setSelectedCountries,
    setSelectedMetric,
    setDataQuality,
    setSearchQuery,
    resetFilters,
  } = useDashboardStore();

  function handleApplyPreset(presetFilters: {
    selectedNetworks?: string[];
    selectedCountries?: string[];
    selectedMetric?: MetricFocus;
    dataQuality?: DataQuality;
  }) {
    if (presetFilters.selectedNetworks !== undefined) {
      setSelectedNetworks(presetFilters.selectedNetworks);
      setStagedNetworks(presetFilters.selectedNetworks);
    }
    if (presetFilters.selectedCountries !== undefined) {
      setSelectedCountries(presetFilters.selectedCountries);
      setStagedCountries(presetFilters.selectedCountries);
    }
    if (presetFilters.selectedMetric !== undefined) setSelectedMetric(presetFilters.selectedMetric);
    if (presetFilters.dataQuality !== undefined) setDataQuality(presetFilters.dataQuality);
  }

  // Staged state for networks + countries
  const [stagedNetworks, setStagedNetworks] = useState<string[]>(filters.selectedNetworks);
  const [stagedCountries, setStagedCountries] = useState<string[]>(filters.selectedCountries);
  const [localSearch, setLocalSearch] = useState(filters.searchQuery);
  const [mobileOpen, setMobileOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync staged from store on external reset
  useEffect(() => {
    setStagedNetworks(filters.selectedNetworks);
    setStagedCountries(filters.selectedCountries);
    setLocalSearch(filters.searchQuery);
  }, [filters.selectedNetworks, filters.selectedCountries, filters.searchQuery]);

  function handleApply() {
    setSelectedNetworks(stagedNetworks);
    setSelectedCountries(stagedCountries);
    setMobileOpen(false);
  }

  function handleClear() {
    setStagedNetworks([]);
    setStagedCountries([]);
    setLocalSearch('');
    resetFilters();
    setMobileOpen(false);
  }

  function handleMetricImmediate(m: MetricFocus) {
    setSelectedMetric(m);
  }

  function handleQualityImmediate(q: DataQuality) {
    setDataQuality(q);
  }

  function handleSearchImmediate(s: string) {
    setLocalSearch(s);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(s), 300);
  }

  // Active filter count
  const activeDimensions = [
    filters.selectedNetworks.length > 0,
    filters.selectedCountries.length > 0,
    filters.selectedMetric !== 'profit',
    filters.dataQuality !== 'all',
    filters.searchQuery !== '',
  ].filter(Boolean).length;

  const panelProps: FilterPanelProps = {
    stagedNetworks, setStagedNetworks,
    stagedCountries, setStagedCountries,
    metric: filters.selectedMetric,
    setMetricImmediate: handleMetricImmediate,
    quality: filters.dataQuality,
    setQualityImmediate: handleQualityImmediate,
    search: localSearch,
    setSearchImmediate: handleSearchImmediate,
    dateFrom, dateTo,
    onApply: handleApply,
    onClear: handleClear,
  };

  return (
    <>
      {/* Desktop toolbar */}
      <div className="hidden sm:flex sticky top-12 z-20 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 items-center gap-2 shadow-sm">
        <div className="flex items-center gap-1.5 mr-1 shrink-0">
          <Filter className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Filters</span>
          {activeDimensions > 0 && (
            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-amber-400 text-white text-[10px] font-bold">
              {activeDimensions}
            </span>
          )}
        </div>
        <FilterPanel {...panelProps} />
        <div className="ml-auto shrink-0">
          <SavedFiltersDropdown
            currentFilters={{
              selectedNetworks: filters.selectedNetworks,
              selectedCountries: filters.selectedCountries,
              selectedMetric: filters.selectedMetric,
              dataQuality: filters.dataQuality,
            }}
            onApply={handleApplyPreset}
          />
        </div>
      </div>

      {/* Mobile: collapsed button */}
      <div className="sm:hidden sticky top-12 z-20">
        <button
          onClick={() => setMobileOpen(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 shadow-sm w-full"
        >
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="font-medium">Filters</span>
          {activeDimensions > 0 && (
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-400 text-white text-xs font-bold ml-1">
              {activeDimensions}
            </span>
          )}
        </button>
      </div>

      {/* Mobile bottom sheet */}
      {mobileOpen && (
        <div className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-t-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Filters</span>
              <button onClick={() => setMobileOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <FilterPanel {...panelProps} />
          </div>
        </div>
      )}
    </>
  );
}
