'use client';

import { useState } from 'react';
import { Loader2, AlertTriangle, X } from 'lucide-react';
import type { CountryOption } from '../types';

interface CountryComboboxProps {
  options: CountryOption[];
  selected: string[];
  isLoading?: boolean;
  isError?: boolean;
  onChange: (countries: string[]) => void;
  onRetry?: () => void;
}

export default function CountryCombobox({
  options, selected, isLoading, isError, onChange, onRetry,
}: CountryComboboxProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = query
    ? options.filter(o =>
        o.countryName.toLowerCase().includes(query.toLowerCase()) ||
        o.country.toLowerCase().includes(query.toLowerCase())
      )
    : options;

  const toggle = (code: string) => {
    onChange(selected.includes(code) ? selected.filter(c => c !== code) : [...selected, code]);
  };

  const selectedLabels = selected.map(c => options.find(o => o.country === c)?.countryName ?? c);

  return (
    <div className="relative min-w-[180px]">
      {/* Input with chips */}
      <div
        className="flex flex-wrap gap-1 items-center min-h-[32px] px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 cursor-text"
        onClick={() => setOpen(true)}
      >
        {selectedLabels.map((label, i) => (
          <span key={selected[i]} className="flex items-center gap-1 px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
            {label}
            <button
              onClick={e => { e.stopPropagation(); toggle(selected[i]); }}
              className="hover:text-blue-900"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={selected.length === 0 ? 'Countries…' : ''}
          className="flex-1 min-w-[60px] text-xs bg-transparent outline-none text-gray-700 dark:text-gray-300 placeholder-gray-400"
        />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-48 overflow-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg text-xs">
          {isLoading ? (
            <div className="flex items-center gap-2 px-3 py-2 text-gray-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading countries…
            </div>
          ) : isError ? (
            <div className="flex items-center gap-2 px-3 py-2 text-amber-600">
              <AlertTriangle className="w-3.5 h-3.5" />
              Could not load countries.{' '}
              {onRetry && <button onClick={onRetry} className="underline">Retry</button>}
            </div>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-2 text-gray-500">No countries found for this date range.</p>
          ) : (
            filtered.map(o => (
              <div
                key={o.country}
                onMouseDown={() => toggle(o.country)}
                className={`px-3 py-2 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center justify-between ${
                  selected.includes(o.country) ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-900 dark:text-gray-100'
                }`}
              >
                <span>{o.countryName} ({o.country})</span>
                {selected.includes(o.country) && <span>✓</span>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
