'use client';

import { useState, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import type { PdfSection } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExportStatus = 'idle' | 'exporting' | 'success' | 'error';
export type Orientation = 'portrait' | 'landscape';
export type PaperSize = 'a4' | 'letter';

export interface PreviewData {
  sheets?: Array<{ name: string; rowCount: number }>;
  totalRows?: number;
  hasData?: boolean;
}

const DEFAULT_SECTIONS: PdfSection[] = [
  'cover_page',
  'executive_summary',
  'daily_trend',
  'geo_breakdown',
  'exoclick',
  'rollerads',
];

export interface UsePdfExportResult {
  selectedSections: PdfSection[];
  orientation: Orientation;
  paperSize: PaperSize;
  filename: string;
  advancedOpen: boolean;
  exportStatus: ExportStatus;
  errorMessage: string | null;
  canExport: boolean;
  toggleSection: (section: PdfSection) => void;
  setOrientation: (v: Orientation) => void;
  setPaperSize: (v: PaperSize) => void;
  setFilename: (v: string) => void;
  toggleAdvanced: () => void;
  handleExport: () => Promise<void>;
}

const ERROR_MESSAGES: Record<number, string> = {
  400: 'Invalid export parameters. Please check your selections.',
  401: 'Session expired. Please refresh the page and try again.',
  403: 'You do not have permission to export this data.',
  404: 'No data found for the selected date range.',
  429: 'Too many export requests. Please wait a moment and try again.',
  500: 'Server error. Please try again in a few moments.',
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePdfExport(
  dateFrom: string,
  dateTo: string,
  previewData: PreviewData | null,
  onClose?: () => void
): UsePdfExportResult {
  const [selectedSections, setSelectedSections] = useState<PdfSection[]>(DEFAULT_SECTIONS);
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [paperSize, setPaperSize] = useState<PaperSize>('a4');
  const [filename, setFilename] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const totalRows = previewData?.totalRows ?? 0;
  const hasData = previewData?.hasData ?? totalRows > 0;
  const canExport = exportStatus !== 'exporting' && selectedSections.length > 0 && hasData;

  const toggleSection = useCallback((section: PdfSection) => {
    setSelectedSections(prev =>
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  }, []);

  const toggleAdvanced = useCallback(() => setAdvancedOpen(p => !p), []);

  const handleExport = useCallback(async () => {
    if (!canExport) return;
    setExportStatus('exporting');
    setErrorMessage(null);
    let url: string | null = null;
    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const payload = {
        dateFrom,
        dateTo,
        sections: selectedSections,
        orientation,
        paperSize,
        ...(filename.trim() ? { filename: filename.trim() } : {}),
      };

      const res = await fetch('/api/export/pdf', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const msg = ERROR_MESSAGES[res.status] ?? `Export failed (${res.status}).`;
        setExportStatus('error');
        setErrorMessage(msg);
        return;
      }

      const blob = await res.blob();
      url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.trim() ? `${filename.trim()}.pdf` : `export-${dateFrom}-${dateTo}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      setExportStatus('success');
      setTimeout(() => { onClose?.(); }, 1500);
    } catch (err) {
      setExportStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Export failed. Please try again.');
    } finally {
      if (url) URL.revokeObjectURL(url);
    }
  }, [canExport, dateFrom, dateTo, selectedSections, orientation, paperSize, filename, onClose]);

  return {
    selectedSections,
    orientation,
    paperSize,
    filename,
    advancedOpen,
    exportStatus,
    errorMessage,
    canExport,
    toggleSection,
    setOrientation,
    setPaperSize,
    setFilename,
    toggleAdvanced,
    handleExport,
  };
}
