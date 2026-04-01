'use client';

import { useState } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { ChevronDown } from 'lucide-react';
import type { AuditLog } from '../types';
import ActionTypeBadge from './ActionTypeBadge';

interface LogTableRowProps {
  log: AuditLog;
}

function resolveDate(createdAt: AuditLog['createdAt']): Date {
  if (typeof createdAt === 'number') return new Date(createdAt);
  if (typeof createdAt === 'string') return new Date(createdAt);
  // Firestore Timestamp
  return (createdAt as { toDate: () => Date }).toDate();
}

function resourceLabel(log: AuditLog): string {
  const type = log.resourceType.replace(/_/g, ' ');
  if (!log.resourceId) return type;
  return `${log.resourceId} ${type}`;
}

function metadataSummary(metadata: Record<string, unknown>): string {
  if (!metadata || Object.keys(metadata).length === 0) return '—';
  if (metadata.changedFields && typeof metadata.changedFields === 'object') {
    const fields = metadata.changedFields as Record<string, { from: unknown; to: unknown }>;
    return Object.entries(fields)
      .slice(0, 2)
      .map(([k, v]) => {
        if (v && typeof v === 'object' && 'from' in v && 'to' in v) {
          return `${k}: ${v.from} → ${v.to}`;
        }
        return k;
      })
      .join(', ');
  }
  const keys = Object.keys(metadata).slice(0, 2);
  return keys.map(k => `${k}: ${JSON.stringify(metadata[k])?.slice(0, 30)}`).join(', ');
}

export default function LogTableRow({ log }: LogTableRowProps) {
  const [expanded, setExpanded] = useState(false);
  const date = resolveDate(log.createdAt);
  const relativeTime = formatDistanceToNow(date, { addSuffix: true });
  const absoluteTime = format(date, 'MMM d, yyyy HH:mm:ss');

  return (
    <>
      <tr
        onClick={() => setExpanded(!expanded)}
        className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
      >
        {/* Timestamp */}
        <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
          <span title={absoluteTime}>{relativeTime}</span>
        </td>
        {/* Action */}
        <td className="px-4 py-3">
          <ActionTypeBadge action={log.action} status={log.status} />
        </td>
        {/* Resource */}
        <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300 max-w-[140px] truncate">
          {resourceLabel(log)}
        </td>
        {/* Details */}
        <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 max-w-[200px] truncate">
          {metadataSummary(log.metadata)}
        </td>
        {/* Expand */}
        <td className="px-4 py-3 text-right">
          <ChevronDown
            className={`w-4 h-4 text-gray-400 inline transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          />
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50 dark:bg-gray-800/30">
          <td colSpan={5} className="px-4 py-3">
            <pre className="text-xs text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-900 rounded-lg p-3 overflow-auto max-h-48 font-mono">
              {JSON.stringify(log.metadata, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}
