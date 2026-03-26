'use client';

import { Info } from 'lucide-react';
import type { FieldMapping } from '../types';

interface FieldMappingTableProps {
  mappings: FieldMapping[];
}

export default function FieldMappingTable({ mappings }: FieldMappingTableProps) {
  return (
    <table className="w-full text-xs border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <thead className="bg-gray-50 dark:bg-gray-800">
        <tr>
          <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">API Field</th>
          <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Internal Field (adStats)</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
        {mappings.map(m => (
          <tr key={`${m.rawField}-${m.internalField}`} className="bg-white dark:bg-gray-900">
            <td className="px-3 py-2 font-mono text-gray-800 dark:text-gray-200">{m.rawField}</td>
            <td className="px-3 py-2 font-mono text-gray-800 dark:text-gray-200">
              <span className="flex items-center gap-1.5">
                {m.internalField}
                {m.notes && (
                  <span title={m.notes} className="cursor-help text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <Info className="w-3 h-3" />
                  </span>
                )}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
