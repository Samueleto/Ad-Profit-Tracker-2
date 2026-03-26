'use client';

import { useRef } from 'react';
import { ALLOWED_NETWORKS, type ReportNetwork } from '../types';

const NETWORK_LABELS: Record<ReportNetwork, string> = {
  exoclick: 'ExoClick',
  rollerads: 'RollerAds',
  zeydoo: 'Zeydoo',
  propush: 'Propush',
};

interface NetworkSelectorProps {
  selected: string[];
  onChange: (networks: string[]) => void;
}

export default function NetworkSelector({ selected, onChange }: NetworkSelectorProps) {
  const allSelected = selected.length === ALLOWED_NETWORKS.length;
  const someSelected = selected.length > 0 && !allSelected;
  const selectAllRef = useRef<HTMLInputElement>(null);

  if (selectAllRef.current) {
    selectAllRef.current.indeterminate = someSelected;
  }

  const toggleAll = () => {
    onChange(allSelected ? [] : [...ALLOWED_NETWORKS]);
  };

  const toggle = (network: string) => {
    onChange(
      selected.includes(network)
        ? selected.filter(n => n !== network)
        : [...selected, network]
    );
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Networks</h3>
      <label className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700/50 cursor-pointer">
        <input
          ref={selectAllRef}
          type="checkbox"
          checked={allSelected}
          onChange={toggleAll}
          className="w-3.5 h-3.5 rounded accent-blue-600"
        />
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">All Networks</span>
      </label>
      <div className="space-y-1.5">
        {ALLOWED_NETWORKS.map(network => (
          <label key={network} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(network)}
              onChange={() => toggle(network)}
              className="w-3.5 h-3.5 rounded accent-blue-600"
            />
            <span className="text-xs text-gray-700 dark:text-gray-300">{NETWORK_LABELS[network]}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
