'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X, ChevronDown, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import { toast } from 'sonner';
import { useDateRangeStore } from '@/store/dateRangeStore';
import { EXPORT_SHEET_KEYS, type ExportSheetKey, type ExportPreviewResponse } from '../types';
import PdfExportTab from '@/features/pdf-export/components/PdfExportTab';

const SHEET_LABELS: Record<ExportSheetKey, string> = {
  summary: 'Summary',
  daily_trend: 'Daily Trend',
  geo_breakdown: 'Geographic Breakdown',
  exoclick: 'ExoClick',
  rollerads: 'RollerAds',
  zeydoo: 'Zeydoo',
  propush: 'ProPush',
  activity_log: 'Activity Log',
};

interface ExportModalProps {
  onClose: () => void;
}

type TabOption = 'excel' | 'pdf';
type ExportErrorType = 403 | 404 | 429 | 500 | null;

export default function ExportModal({ onClose }: ExportModalProps) {
  const router = useRouter();
  const { fromDate, toDate } = useDateRangeStore();

  const [activeTab, setActiveTab] = useState<TabOption>('excel');
  const [selectedSheets, setSelectedSheets] = useState<Set<ExportSheetKey>>(new Set(EXPORT_SHEET_KEYS));
  const [preview, setPreview] = useState<ExportPreviewResponse | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [filename, setFilename] = useState('');
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<ExportErrorType>(null);

  const anchorRef = useRef<HTMLAnchorElement>(null);

  // Escape key closes modal (unless export is in progress)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !exporting) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [exporting, onClose]);

  const getToken = async (refresh = false) => {
    const auth = getAuth();
    return auth.currentUser?.getIdToken(refresh);
  };

  useEffect(() => {
    const fetchPreview = async () => {
      setPreviewLoading(true);
      setPreviewFailed(false);
      try {
        const token = await getToken();
        const res = await fetch(`/api/export/preview?dateFrom=${fromDate}&dateTo=${toDate}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const data: ExportPreviewResponse = await res.json();
        setPreview(data);
      } catch {
        setPreview(null);
        setPreviewFailed(true);
      } finally {
        setPreviewLoading(false);
      }
    };
    fetchPreview();
  }, [fromDate, toDate]);

  const toggleSheet = (key: ExportSheetKey) => {
    setSelectedSheets(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedSheets.size === EXPORT_SHEET_KEYS.length) {
      setSelectedSheets(new Set());
    } else {
      setSelectedSheets(new Set(EXPORT_SHEET_KEYS));
    }
  };

  const handleFilenameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100);
    setFilename(val);
  };

  // Only disable for no-data when preview definitively says hasData === false (not on preview failure)
  const noDataDefinitive = preview !== null && preview.hasData === false;
  const noDataFromPost = errorType === 404;

  const exportDisabled =
    exporting ||
    selectedSheets.size === 0 ||
    noDataDefinitive ||
    noDataFromPost ||
    errorType === 429;

  const exportTooltip =
    noDataDefinitive || noDataFromPost
      ? 'No data found for this date range'
      : selectedSheets.size === 0
      ? 'Select at least one sheet to export'
      : undefined;

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    setErrorType(null);
    try {
      let token = await getToken();
      const payload = {
        dateFrom: fromDate,
        dateTo: toDate,
        sheets: [...selectedSheets],
        filename: filename || undefined,
        includeHeaders,
      };
      const doFetch = (t?: string) =>
        fetch('/api/export/excel', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(t ? { Authorization: `Bearer ${t}` } : {}),
          },
          body: JSON.stringify(payload),
        });

      let res: Response;
      try {
        res = await doFetch(token);
      } catch {
        // Network failure — treat same as 500
        setErrorType(500);
        setExportError('Something went wrong generating your file.');
        return;
      }

      if (res.status === 401) {
        try {
          token = await getToken(true);
          res = await doFetch(token);
          if (res.status === 401) {
            onClose();
            toast.error('Session expired');
            router.push('/');
            return;
          }
          // Refresh succeeded — show toast and let user retry
          onClose();
          toast.success('Session refreshed, please try again');
          return;
        } catch {
          onClose();
          toast.error('Session expired');
          router.push('/');
          return;
        }
      }

      if (res.status === 403) {
        setErrorType(403);
        setExportError('Access Denied');
        return;
      }

      if (res.status === 404) {
        setErrorType(404);
        setExportError('No data found for this date range');
        return;
      }

      if (res.status === 429) {
        setErrorType(429);
        setExportError('Export limit reached. You can export up to 10 files per hour. Please try again later.');
        return;
      }

      if (!res.ok) {
        setErrorType(500);
        setExportError('Something went wrong generating your file.');
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (anchorRef.current) {
        anchorRef.current.href = url;
        anchorRef.current.download = (filename || 'export') + '.xlsx';
        anchorRef.current.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }

      toast.success('Export complete — file downloaded');
      setTimeout(() => onClose(), 1500);
    } finally {
      setExporting(false);
    }
  };

  const dismissError = () => {
    setExportError(null);
    setErrorType(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop — no close while exporting */}
      <div className="absolute inset-0 bg-black/40" onClick={exporting ? undefined : onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Export Data</h2>
          <button onClick={exporting ? undefined : onClose} disabled={exporting} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-5">
          {(['excel', 'pdf'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2.5 px-3 text-xs font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab === 'excel' ? 'Excel (.xlsx)' : 'PDF'}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* PDF tab */}
          <div className={activeTab !== 'pdf' ? 'hidden' : ''}>
            <PdfExportTab
              dateFrom={fromDate}
              dateTo={toDate}
              preview={preview}
              previewLoading={previewLoading}
              onClose={onClose}
            />
          </div>

          {/* Excel tab content */}
          <div className={activeTab !== 'excel' ? 'hidden' : ''}>
            <>
              {/* Date range display */}
              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <span className="font-medium">Date range:</span>
                <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                  {fromDate} → {toDate}
                </span>
              </div>

              {/* Sheet selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Sheets to include</p>
                  <button
                    onClick={toggleAll}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {selectedSheets.size === EXPORT_SHEET_KEYS.length ? 'Deselect all' : 'Select all'}
                  </button>
                </div>

                <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700/50 overflow-hidden">
                  {previewLoading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="px-3 py-2.5 flex items-center justify-between animate-pulse">
                          <div className="flex items-center gap-2">
                            <div className="w-3.5 h-3.5 bg-gray-200 dark:bg-gray-700 rounded" />
                            <div className="h-3 w-28 bg-gray-200 dark:bg-gray-700 rounded" />
                          </div>
                          <div className="h-4 w-8 bg-gray-200 dark:bg-gray-700 rounded-full" />
                        </div>
                      ))
                    : EXPORT_SHEET_KEYS.map(key => {
                        const rowCount = preview?.sheets[key] ?? 0;
                        const isSelected = selectedSheets.has(key);
                        return (
                          <label
                            key={key}
                            className="flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={exporting}
                                onChange={() => toggleSheet(key)}
                                className="w-3.5 h-3.5 rounded accent-blue-600"
                              />
                              <span className="text-xs text-gray-700 dark:text-gray-300">{SHEET_LABELS[key]}</span>
                            </div>
                            {previewFailed ? (
                              <span className="text-xs text-gray-400 italic">Row counts unavailable</span>
                            ) : (
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                rowCount === 0
                                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                                  : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                              }`}>
                                {rowCount.toLocaleString()}
                              </span>
                            )}
                          </label>
                        );
                      })}
                </div>

                {exporting && (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Generating your Excel file...
                  </p>
                )}
              </div>

              {/* Advanced */}
              <div>
                <button
                  onClick={() => setAdvancedOpen(v => !v)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
                  Advanced
                </button>
                {advancedOpen && (
                  <div className="mt-3 space-y-3 pl-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Custom filename
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={filename}
                          onChange={handleFilenameChange}
                          placeholder="ad-profit-export"
                          className="w-full pr-12 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                          {filename.length}/100
                        </span>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeHeaders}
                        onChange={e => setIncludeHeaders(e.target.checked)}
                        className="w-3.5 h-3.5 rounded accent-blue-600"
                      />
                      <span className="text-xs text-gray-600 dark:text-gray-400">Include column headers</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Error banners */}
              {exportError && errorType === 500 && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="flex items-center gap-1 text-xs text-red-700 dark:text-red-300 flex-1">
                    <span>{exportError}</span>
                    <button onClick={handleExport} className="underline hover:no-underline font-medium ml-1">
                      Retry
                    </button>
                  </div>
                </div>
              )}

              {exportError && errorType === 403 && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                  <span className="text-xs text-red-700 dark:text-red-300 flex-1">{exportError}</span>
                  <button onClick={onClose} className="text-red-400 hover:text-red-600 dark:hover:text-red-300">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {exportError && errorType === 429 && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-amber-700 dark:text-amber-300 flex-1">{exportError}</span>
                  <button onClick={dismissError} className="text-amber-400 hover:text-amber-600 dark:hover:text-amber-300">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </>
          </div>
        </div>

        {/* Footer — only for Excel tab; PDF tab has its own action bar */}
        {activeTab === 'excel' && (
          <div className="flex gap-2 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="flex-1 py-2 text-xs font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={exportDisabled}
              title={exportTooltip}
              className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {exporting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Export Now
            </button>
          </div>
        )}

        {/* Hidden anchor for download */}
        <a ref={anchorRef} className="hidden" />
      </div>
    </div>
  );
}
