'use client';

import { useState, useEffect } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import { useDashboardStore } from '@/store/dashboardStore';
import { useDateRangeStore } from '@/store/dateRangeStore';
import { DEFAULT_FILTER_STATE } from '../constants';
import type { FilterState, CountryOption, MetricKey, DataQualityOption } from '../types';
import NetworkCheckboxGroup from './NetworkCheckboxGroup';
import CountryCombobox from './CountryCombobox';
import MetricPillGroup from './MetricPillGroup';
import DataQualityToggle from './DataQualityToggle';
import FilterSearchInput from './FilterSearchInput';

// Local filter state separate from store until "Apply" is clicked
function countActiveFilters(f: Partial<FilterState>): number {
  let count = 0;
  if ((f.selectedNetworks?.length ?? 0) > 0) count++;
  if ((f.selectedCountries?.length ?? 0) > 0) count++;
  if (f.selectedMetric && f.selectedMetric !== DEFAULT_FILTER_STATE.selectedMetric) count++;
  if (f.dataQuality && f.dataQuality !== DEFAULT_FILTER_STATE.dataQuality) count++;
  if (f.searchQuery && f.searchQuery !== '') count++;
  return count;
}

export default function FilterToolbar() {
  const { fromDate, toDate } = useDateRangeStore();
  const { filters, setSelectedNetworks, setSelectedCountries, resetFilters } = useDashboardStore();

  const [localNetworks, setLocalNetworks] = useState<string[]>(filters.selectedNetworks);
  const [localCountries, setLocalCountries] = useState<string[]>(filters.selectedCountries);
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('profit');
  const [dataQuality, setDataQuality] = useState<DataQualityOption>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [countryOptions, setCountryOptions] = useState<CountryOption[]>([]);
  const [countryLoading, setCountryLoading] = useState(false);
  const [countryError, setCountryError] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeCount = countActiveFilters({
    selectedNetworks: localNetworks,
    selectedCountries: localCountries,
    selectedMetric,
    dataQuality,
    searchQuery,
  });

  const fetchCountries = async () => {
    setCountryLoading(true);
    setCountryError(false);
    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/filters/options?type=country&from=${fromDate}&to=${toDate}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCountryOptions(data.countries ?? []);
    } catch {
      setCountryError(true);
    } finally {
      setCountryLoading(false);
    }
  };

  useEffect(() => { fetchCountries(); }, [fromDate, toDate]);

  const handleApply = () => {
    setSelectedNetworks(localNetworks);
    setSelectedCountries(localCountries);
    setMobileOpen(false);
  };

  const handleClearAll = () => {
    setLocalNetworks([]);
    setLocalCountries([]);
    setSelectedMetric('profit');
    setDataQuality('all');
    setSearchQuery('');
    resetFilters();
  };

  const controls = (
    <div className="flex flex-wrap items-center gap-2">
      <NetworkCheckboxGroup selectedNetworks={localNetworks} onChange={setLocalNetworks} />
      <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 hidden sm:block" />
      <CountryCombobox
        options={countryOptions}
        selected={localCountries}
        isLoading={countryLoading}
        isError={countryError}
        onChange={setLocalCountries}
        onRetry={fetchCountries}
      />
      <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 hidden sm:block" />
      <MetricPillGroup selectedMetric={selectedMetric} onChange={setSelectedMetric} />
      <DataQualityToggle dataQuality={dataQuality} onChange={setDataQuality} />
      <div className="flex-1" />
      <FilterSearchInput searchQuery={searchQuery} onChange={setSearchQuery} />
      <button
        onClick={handleApply}
        className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
      >
        Apply
      </button>
      {activeCount > 0 && (
        <button
          onClick={handleClearAll}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <X className="w-3 h-3" />
          Clear all
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block sticky top-[40px] z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-2">
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Filters ({activeCount})
            </span>
          )}
          {controls}
        </div>
      </div>

      {/* Mobile: single button */}
      <div className="md:hidden sticky top-[40px] z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-2">
        <button
          onClick={() => setMobileOpen(true)}
          className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {activeCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-500" />
          )}
        </button>
      </div>

      {/* Mobile bottom sheet */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setMobileOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 rounded-t-2xl p-4 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Filters</h3>
              <button onClick={() => setMobileOpen(false)}>
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <NetworkCheckboxGroup selectedNetworks={localNetworks} onChange={setLocalNetworks} />
              <CountryCombobox
                options={countryOptions}
                selected={localCountries}
                isLoading={countryLoading}
                isError={countryError}
                onChange={setLocalCountries}
                onRetry={fetchCountries}
              />
              <MetricPillGroup selectedMetric={selectedMetric} onChange={setSelectedMetric} />
              <DataQualityToggle dataQuality={dataQuality} onChange={setDataQuality} />
              <FilterSearchInput searchQuery={searchQuery} onChange={setSearchQuery} />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleApply} className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg">Apply</button>
              <button onClick={handleClearAll} className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg">Clear all</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
