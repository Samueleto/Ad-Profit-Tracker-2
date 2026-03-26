'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import type { ExportPreviewResponse } from '@/features/excel-export/types';
import { ALLOWED_SECTIONS, type PdfSection, type PdfExportRequest } from '../types';

const SECTION_LABELS: Record<PdfSection, string> = {
  cover_page: 'Cover Page',
  executive_summary: 'Executive Summary',
  daily_trend: 'Daily Profit Trend Chart',
  geo_breakdown: 'Geographic Breakdown Table',
  exoclick: 'ExoClick Stats',
  rollerads: 'RollerAds Stats',
  zeydoo: 'Zeydoo Stats',
  propush: 'ProPush Stats',
  activity_log: 'Activity Log',
};

interface PdfExportTabProps {
  dateFrom: string;
  dateTo: string;
  preview: ExportPreviewResponse | null;
  previewLoading: boolean;
  onClose: () => void;
}

export default function PdfExportTab({ dateFrom, dateTo, preview, previewLoading, onClose }: PdfExportTabProps) {
  const router = useRouter();
  const anchorRef = useRef<HTMLAnchorElement>(null);

  const [selectedSections, setSelectedSections] = useState<Set<PdfSection>>(new Set(ALLOWED_SECTIONS));
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [paperSize, setPaperSize] = useState<'a4' | 'letter'>('a4');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [filename, setFilename] = useState('');
  const [filenameError, setFilenameError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const getToken = async (refresh = false) => {
    const auth = getAuth();
    return auth.currentUser?.getIdToken(refresh);
  };

  const toggleSection = (key: PdfSection) => {
    setSelectedSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleFilenameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const cleaned = val.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100);
    setFilename(cleaned);
    if (val !== cleaned) {
      setFilenameError('Only alphanumeric characters, dashes, and underscores allowed.');
    } else {
      setFilenameError('');
    }
  };

  const exportDisabled = exporting || selectedSections.size === 0 || !preview?.hasData;
  const exportTooltip = !preview?.hasData ? 'No data available for this range'
    : selectedSections.size === 0 ? 'Select at least one section'
    : undefined;

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    setErrorType(null);

    const payload: PdfExportRequest = {
      dateFrom,
      dateTo,
      sections: [...selectedSections],
      orientation,
      paperSize,
      filename: filename || undefined,
    };

    const doFetch = (token?: string) =>
      fetch('/api/export/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

    try {
      let token = await getToken();
      let res = await doFetch(token);

      if (res.status === 401) {
        try {
          token = await getToken(true);
          res = await doFetch(token);
          if (res.status === 401) {
            onClose();
            router.push('/');
            return;
          }
        } catch {
          onClose();
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
      if (!res.ok) {
        setErrorType(500);
        setExportError('PDF export failed. Please try again.');
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (anchorRef.current) {
        anchorRef.current.href = url;
        anchorRef.current.download = (filename || 'export') + '.pdf';
        anchorRef.current.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }

      setToast('PDF export complete — file downloaded');
      setTimeout(() => onClose(), 1500);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Section checkboxes */}
      <div>
        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Sections to include</p>
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700/50 overflow-hidden">
          {previewLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="px-3 py-2.5 flex items-center justify-between animate-pulse">
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="h-3 w-36 bg-gray-200 dark:bg-gray-700 rounded" />
                  </div>
                  <div className="h-4 w-8 bg-gray-200 dark:bg-gray-700 rounded-full" />
                </div>
              ))
            : ALLOWED_SECTIONS.map(key => {
                const rowCount = preview?.sheets[key as keyof typeof preview.sheets] ?? 0;
                const isSelected = selectedSections.has(key);
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
                        onChange={() => toggleSection(key)}
                        className="w-3.5 h-3.5 rounded accent-blue-600"
                      />
                      <span className="text-xs text-gray-700 dark:text-gray-300">{SECTION_LABELS[key]}</span>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      rowCount === 0
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    }`}>
                      {rowCount.toLocaleString()}
                    </span>
                  </label>
                );
              })}
        </div>

        {exporting && (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            Generating your PDF report...
          </p>
        )}
      </div>

      {/* Options row */}
      <div>
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Options</p>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Orientation</label>
            <select
              value={orientation}
              onChange={e => setOrientation(e.target.value as 'portrait' | 'landscape')}
              disabled={exporting}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Paper Size</label>
            <select
              value={paperSize}
              onChange={e => setPaperSize(e.target.value as 'a4' | 'letter')}
              disabled={exporting}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="a4">A4</option>
              <option value="letter">Letter</option>
            </select>
          </div>
        </div>
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
          <div className="mt-3 pl-4">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Custom filename
            </label>
            <div className="relative">
              <input
                type="text"
                value={filename}
                onChange={handleFilenameChange}
                placeholder="pdf-export"
                disabled={exporting}
                className="w-full pr-12 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                {filename.length}/100
              </span>
            </div>
            {filenameError && (
              <p className="mt-1 text-xs text-red-500">{filenameError}</p>
            )}
          </div>
        )}
      </div>

      {/* Error banners */}
      {exportError && errorType === 500 && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex items-center gap-1 text-xs text-red-700 dark:text-red-300">
            <span>{exportError}</span>
            <button onClick={handleExport} className="underline hover:no-underline font-medium ml-1">
              Retry
            </button>
          </div>
        </div>
      )}
      {exportError && errorType === 403 && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
          <span className="text-xs text-red-700 dark:text-red-300">{exportError}</span>
        </div>
      )}
      {exportError && errorType === 404 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">{exportError}</p>
      )}

      {/* Toast */}
      {toast && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
          <CheckCircle className="w-3.5 h-3.5 text-green-500" />
          <span className="text-xs text-green-700 dark:text-green-300">{toast}</span>
        </div>
      )}

      {/* Action bar */}
      <div className="flex gap-2 pt-2">
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

      <a ref={anchorRef} className="hidden" />
    </div>
  );
}
