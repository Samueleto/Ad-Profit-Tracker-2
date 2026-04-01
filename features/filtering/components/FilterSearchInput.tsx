'use client';

import { useRef } from 'react';
import { Search } from 'lucide-react';

interface FilterSearchInputProps {
  searchQuery: string;
  onChange: (query: string) => void;
}

export default function FilterSearchInput({ searchQuery, onChange }: FilterSearchInputProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(val), 300);
  };

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
      <input
        type="text"
        defaultValue={searchQuery}
        onChange={handleChange}
        placeholder="Search…"
        className="pl-8 pr-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-36"
      />
    </div>
  );
}
