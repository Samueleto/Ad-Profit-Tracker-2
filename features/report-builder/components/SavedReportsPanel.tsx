'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, Pencil, Trash2, Check } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import { toast } from 'sonner';
import type { SavedReport, ReportConfig } from '../types';

interface SavedReportsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onLoad: (config: ReportConfig) => void;
}

export default function SavedReportsPanel({ isOpen, onClose, onLoad }: SavedReportsPanelProps) {
  const router = useRouter();
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const getToken = async (refresh = false) => {
    const auth = getAuth();
    return auth.currentUser?.getIdToken(refresh);
  };

  const handle401 = () => {
    toast.error('Session expired. Please sign in again.');
    router.replace('/');
  };

  useEffect(() => {
    if (!isOpen) return;
    const fetchReports = async () => {
      setLoading(true);
      try {
        let token = await getToken();
        let res = await fetch('/api/reports', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (res.status === 401) {
          token = await getToken(true);
          res = await fetch('/api/reports', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
          if (res.status === 401) { handle401(); return; }
        }
        if (!res.ok) throw new Error();
        const data = await res.json();
        setReports(data.reports ?? []);
      } catch {
        setReports([]);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleRename = async (id: string) => {
    if (!editingName.trim()) { setEditingId(null); return; }
    const renameInit = {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' } as Record<string, string>,
      body: JSON.stringify({ name: editingName.trim() }),
    };
    try {
      let token = await getToken();
      let res = await fetch(`/api/reports/${id}`, { ...renameInit, headers: { ...renameInit.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      if (res.status === 401) {
        token = await getToken(true);
        res = await fetch(`/api/reports/${id}`, { ...renameInit, headers: { ...renameInit.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
        if (res.status === 401) { handle401(); return; }
      }
      if (res.ok) setReports(prev => prev.map(r => r.id === id ? { ...r, name: editingName.trim() } : r));
    } finally {
      setEditingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      let token = await getToken();
      let res = await fetch(`/api/reports/${id}`, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (res.status === 401) {
        token = await getToken(true);
        res = await fetch(`/api/reports/${id}`, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (res.status === 401) { handle401(); return; }
      }
      if (res.ok) setReports(prev => prev.filter(r => r.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop (mobile) */}
      <div
        className="fixed inset-0 z-40 bg-black/30 lg:hidden"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-gray-900 shadow-2xl flex flex-col lg:relative lg:inset-auto lg:w-64 lg:shadow-none lg:border-r lg:border-gray-200 lg:dark:border-gray-700">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Saved Reports</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse flex items-center gap-2 px-2 py-2.5">
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded flex-1" />
                  <div className="h-6 w-10 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
              ))
            : reports.length === 0
            ? (
                <p className="text-xs text-gray-400 text-center py-6">No saved reports yet.</p>
              )
            : reports.map(report => (
                <div
                  key={report.id}
                  className="group flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  {editingId === report.id ? (
                    <input
                      autoFocus
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRename(report.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      onBlur={() => handleRename(report.id)}
                      className="flex-1 text-xs px-1 py-0.5 border border-blue-400 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none"
                    />
                  ) : (
                    <span
                      className="flex-1 text-xs text-gray-700 dark:text-gray-300 cursor-pointer truncate"
                      onClick={() => { setEditingId(report.id); setEditingName(report.name); }}
                    >
                      {report.name}
                    </span>
                  )}

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onLoad({
                        metrics: report.metrics,
                        networks: report.networks,
                        countries: report.countries,
                        groupBy: report.groupBy,
                        dataQuality: report.dataQuality,
                        dateRangePreset: report.dateRangePreset,
                        dateFrom: report.dateFrom,
                        dateTo: report.dateTo,
                      })}
                      className="px-1.5 py-0.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      Load
                    </button>

                    {deletingId === report.id ? (
                      <>
                        <button
                          onClick={() => handleDelete(report.id)}
                          className="p-1 text-red-500 hover:text-red-700"
                          title="Confirm delete"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setDeletingId(null)}
                          className="p-1 text-gray-400 hover:text-gray-600"
                          title="Cancel"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => { setEditingId(report.id); setEditingName(report.name); }}
                          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          title="Rename"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setDeletingId(report.id)}
                          className="p-1 text-gray-400 hover:text-red-500"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
        </div>
      </div>
    </>
  );
}
