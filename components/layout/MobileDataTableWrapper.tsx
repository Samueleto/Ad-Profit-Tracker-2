'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface ColumnConfig {
  key: string;
  label: string;
  visibility: 'primary' | 'secondary';
  render?: (row: Record<string, unknown>) => React.ReactNode;
}

interface MobileDataTableWrapperProps {
  columns: ColumnConfig[];
  rows: Record<string, unknown>[];
  rowKey: string;
  scrollable?: boolean;
  className?: string;
}

function CardRow({
  columns,
  row,
}: {
  columns: ColumnConfig[];
  row: Record<string, unknown>;
}) {
  const [expanded, setExpanded] = useState(false);
  const primary = columns.filter(c => c.visibility === 'primary');
  const secondary = columns.filter(c => c.visibility === 'secondary');

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 space-y-2">
      {/* Primary fields */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {primary.map(col => (
          <div key={col.key} className="min-w-[80px]">
            <p className="text-[10px] text-gray-500 dark:text-gray-400">{col.label}</p>
            <p className="text-xs font-medium text-gray-900 dark:text-white">
              {col.render ? col.render(row) : String(row[col.key] ?? '—')}
            </p>
          </div>
        ))}
      </div>

      {/* Secondary fields (collapsible) */}
      {secondary.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            {expanded ? 'Show less' : 'Show more'}
          </button>
          {expanded && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 border-t border-gray-100 dark:border-gray-800">
              {secondary.map(col => (
                <div key={col.key} className="min-w-[80px]">
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">{col.label}</p>
                  <p className="text-xs font-medium text-gray-900 dark:text-white">
                    {col.render ? col.render(row) : String(row[col.key] ?? '—')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function MobileDataTableWrapper({
  columns,
  rows,
  rowKey,
  scrollable = false,
  className = '',
}: MobileDataTableWrapperProps) {
  // Render nothing when there are no rows — parent handles empty state
  if (!rows || rows.length === 0) return null;

  // Columns fallback: treat all as primary if config is missing or malformed
  const safeColumns: ColumnConfig[] = columns?.length
    ? columns.map(c => ({ ...c, visibility: c.visibility === 'primary' || c.visibility === 'secondary' ? c.visibility : 'primary' }))
    : rows[0]
      ? Object.keys(rows[0]).map(k => ({ key: k, label: k, visibility: 'primary' as const }))
      : [];

  return (
    <>
      {/* Mobile: card list */}
      <div className={`md:hidden space-y-2 ${className}`}>
        {rows.map(row => (
          <CardRow key={String(row[rowKey])} columns={safeColumns} row={row} />
        ))}
      </div>

      {/* Desktop: standard table */}
      <div
        className={`hidden md:block ${scrollable ? 'overflow-x-auto relative' : ''} ${className}`}
        style={scrollable ? {
          maskImage: 'linear-gradient(to right, transparent, black 8px, black calc(100% - 8px), transparent)',
          WebkitMaskImage: 'linear-gradient(to right, transparent, black 8px, black calc(100% - 8px), transparent)',
        } : undefined}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              {safeColumns.map(col => (
                <th
                  key={col.key}
                  className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map(row => (
              <tr key={String(row[rowKey])}>
                {safeColumns.map(col => (
                  <td key={col.key} className="px-3 py-2.5 text-gray-900 dark:text-gray-100">
                    {col.render ? col.render(row) : String(row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
