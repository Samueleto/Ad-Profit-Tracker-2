'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { getAuth } from 'firebase/auth';
import { Loader2 } from 'lucide-react';

interface EmailLogEntry {
  id: string;
  emailType: string;
  recipient: string;
  status: 'success' | 'failure';
  sentAt: string;
  triggeredBy: string;
}

interface EmailLogTableProps {
  // Optional: pass initial data/loading control from parent
}

export default function EmailLogTable(_props: EmailLogTableProps) {
  const [rows, setRows] = useState<EmailLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);

  const fetchLog = useCallback(async (nextCursor?: string) => {
    const isMore = !!nextCursor;
    isMore ? setLoadingMore(true) : setLoading(true);
    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      const url = `/api/emails/send?limit=20${nextCursor ? `&cursor=${nextCursor}` : ''}`;
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) return;
      const data = await res.json();
      setRows(prev => isMore ? [...prev, ...(data.logs ?? [])] : (data.logs ?? []));
      setHasMore(data.hasMore ?? false);
      setCursor(data.nextCursor ?? null);
    } finally {
      isMore ? setLoadingMore(false) : setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLog(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-8 bg-gray-200 dark:bg-gray-700 rounded" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Type</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Recipient</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Status</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Sent</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Triggered By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-gray-400">No email history yet.</td>
              </tr>
            ) : rows.map(row => (
              <tr key={row.id} className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300 capitalize">{row.emailType.replace(/_/g, ' ')}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400 truncate max-w-[140px]">{row.recipient}</td>
                <td className="px-3 py-2">
                  <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-medium ${
                    row.status === 'success'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  }`}>
                    {row.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                  {(() => { try { return formatDistanceToNow(parseISO(row.sentAt), { addSuffix: true }); } catch { return row.sentAt; } })()}
                </td>
                <td className="px-3 py-2 text-gray-500">{row.triggeredBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <div className="text-center">
          <button
            onClick={() => cursor && fetchLog(cursor)}
            disabled={loadingMore}
            className="flex items-center gap-1.5 mx-auto text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            {loadingMore && <Loader2 className="w-3 h-3 animate-spin" />}
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
