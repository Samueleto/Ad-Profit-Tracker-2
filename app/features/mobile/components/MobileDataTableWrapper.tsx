"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export interface TableColumn<T> {
  key: keyof T | string;
  header: string;
  priority: "primary" | "secondary";
  render?: (row: T) => React.ReactNode;
}

interface MobileDataTableWrapperProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  scrollable?: boolean;
}

export default function MobileDataTableWrapper<T>({
  columns,
  data,
  rowKey,
  scrollable = false,
}: MobileDataTableWrapperProps<T>) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (key: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const primaryCols = columns.filter((c) => c.priority === "primary");
  const secondaryCols = columns.filter((c) => c.priority === "secondary");

  const getCellValue = (row: T, col: TableColumn<T>): React.ReactNode => {
    if (col.render) return col.render(row);
    const value = (row as Record<string, unknown>)[col.key as string];
    return value != null ? String(value) : "—";
  };

  // Desktop: standard table
  const desktopTable = (
    <div className={`hidden md:block ${scrollable ? "overflow-x-auto" : ""}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            {columns.map((col) => (
              <th
                key={col.key as string}
                className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {data.map((row) => (
            <tr key={rowKey(row)} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              {columns.map((col) => (
                <td key={col.key as string} className="px-3 py-2 text-gray-900 dark:text-gray-100">
                  {getCellValue(row, col)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // Mobile: card layout
  const mobileCards = (
    <div className="md:hidden space-y-2">
      {data.map((row) => {
        const key = rowKey(row);
        const isExpanded = expandedRows.has(key);
        return (
          <div
            key={key}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            {/* Primary columns */}
            <div className="flex items-center p-3 gap-3">
              <div className="flex-1 grid grid-cols-2 gap-2">
                {primaryCols.map((col) => (
                  <div key={col.key as string}>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{col.header}</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {getCellValue(row, col)}
                    </p>
                  </div>
                ))}
              </div>
              {secondaryCols.length > 0 && (
                <button
                  onClick={() => toggleRow(key)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  aria-label={isExpanded ? "Collapse" : "Expand"}
                >
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              )}
            </div>

            {/* Secondary columns (expanded) */}
            {isExpanded && secondaryCols.length > 0 && (
              <div className="border-t border-gray-100 dark:border-gray-700 p-3 grid grid-cols-2 gap-2 bg-gray-50 dark:bg-gray-800/50">
                {secondaryCols.map((col) => (
                  <div key={col.key as string}>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{col.header}</p>
                    <p className="text-sm text-gray-900 dark:text-white">{getCellValue(row, col)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      {desktopTable}
      {mobileCards}
    </>
  );
}
