'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { NetworkId } from '../types';

interface NetworkAccordionProps {
  networkId: NetworkId;
  displayName: string;
  children: React.ReactNode;
}

export default function NetworkAccordion({ displayName, children }: NetworkAccordionProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 text-left transition-colors"
      >
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{displayName}</span>
        <ChevronRight
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        />
      </button>
      {open && (
        <div className="px-4 py-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          {children}
        </div>
      )}
    </div>
  );
}
