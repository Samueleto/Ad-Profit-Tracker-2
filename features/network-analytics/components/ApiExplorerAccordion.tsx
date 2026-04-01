'use client';

import { useState } from 'react';
import { ChevronDown, Copy, Loader2 } from 'lucide-react';

interface FieldMapping {
  apiField: string;
  appField: string;
  type: string;
}

interface ApiExplorerAccordionProps {
  networkId: string;
  networkName: string;
  endpoint: string;
  method: 'GET' | 'POST';
  requiredParams: string[];
  fieldMappings: FieldMapping[];
  rawResponse: unknown | null;
  lastFetchedAt: string | null;
  hasApiKey: boolean;
  isLoading?: boolean;
  onFetchSample: () => void;
}

export default function ApiExplorerAccordion({
  networkName,
  endpoint,
  method,
  requiredParams,
  fieldMappings,
  rawResponse,
  lastFetchedAt,
  hasApiKey,
  isLoading,
  onFetchSample,
}: ApiExplorerAccordionProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(rawResponse, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            {method}
          </span>
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{networkName}</span>
          <span className="text-xs text-gray-500 font-mono truncate max-w-[200px]">{endpoint}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 py-4 space-y-4">
          {/* Required params */}
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Required Parameters</p>
            <div className="flex flex-wrap gap-1.5">
              {requiredParams.map(p => (
                <span key={p} className="text-xs font-mono px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded">
                  {p}
                </span>
              ))}
            </div>
          </div>

          {/* Field mapping table */}
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Field Mappings</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="py-1.5 pr-4 text-left text-gray-400 font-medium">API Field</th>
                    <th className="py-1.5 pr-4 text-left text-gray-400 font-medium">App Field</th>
                    <th className="py-1.5 text-left text-gray-400 font-medium">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {fieldMappings.map(f => (
                    <tr key={f.apiField}>
                      <td className="py-1.5 pr-4 font-mono text-gray-700 dark:text-gray-300">{f.apiField}</td>
                      <td className="py-1.5 pr-4 font-mono text-blue-600 dark:text-blue-400">{f.appField}</td>
                      <td className="py-1.5 text-gray-500 dark:text-gray-400">{f.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* JSON response / no API key */}
          {!hasApiKey ? (
            <div className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
              API key not configured —{' '}
              <a href="/settings" className="underline">go to Settings</a>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Raw Response
                  {lastFetchedAt && (
                    <span className="ml-2 text-gray-400">· Last fetched {new Date(lastFetchedAt).toLocaleString()}</span>
                  )}
                </p>
                <div className="flex gap-2">
                  {rawResponse != null && (
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  )}
                  <button
                    onClick={onFetchSample}
                    disabled={isLoading}
                    className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
                  >
                    {isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                    Fetch Sample
                  </button>
                </div>
              </div>
              {isLoading ? (
                <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
              ) : (
                <pre className="text-xs bg-gray-100 dark:bg-gray-900 rounded-lg p-3 overflow-auto max-h-56 font-mono text-gray-700 dark:text-gray-300">
                  {rawResponse ? JSON.stringify(rawResponse, null, 2) : 'No sample fetched yet.'}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
