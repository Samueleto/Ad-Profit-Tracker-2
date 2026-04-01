// Step 139: Filtering constants and defaults

import type { FilterState } from './types';

export const DEFAULT_FILTER_STATE: FilterState = {
  selectedNetworks: [],
  selectedCountries: [],
  selectedMetric: 'profit',
  dataQuality: 'all',
  searchQuery: '',
};
