'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Copy, Check } from 'lucide-react';

const ReactJson = dynamic(() => import('react-json-view'), { ssr: false });

interface JsonResponseViewerProps {
  data: Record<string, unknown> | null;
  fetchedAt?: string | null;
  isLoading?: boolean;
}

export default function JsonResponseViewer({ data, fetchedAt, isLoading }: JsonResponseViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!data) return;
    navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (isLoading && data == null) {
    return (
      <div className="space-y-2 animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    );
  }

  if (data == null) {
    return (
      <p className="text-xs text-gray-500 dark:text-gray-400 italic py-2">
        No response cached yet. Click Fetch Fresh Sample to retrieve one.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <ReactJson
          src={data}
          collapsed={2}
          displayDataTypes={false}
          displayObjectSize={false}
          enableClipboard={false}
          style={{ fontSize: '12px', padding: '12px', background: 'transparent' }}
          theme="rjv-default"
        />
      </div>

      <div className="flex items-center justify-between">
        {fetchedAt && (
          <p className="text-xs text-gray-400">
            Last fetched:{' '}
            <span className="text-gray-600 dark:text-gray-300">
              {formatDistanceToNow(parseISO(fetchedAt), { addSuffix: true })}
            </span>
          </p>
        )}
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-green-500" />
              <span className="text-green-500">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copy to Clipboard
            </>
          )}
        </button>
      </div>
    </div>
  );
}
