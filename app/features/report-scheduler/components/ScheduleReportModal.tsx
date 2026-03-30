'use client';

import { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { X, Loader2, ChevronDown, Send } from 'lucide-react';
import { format, addDays } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────

type Frequency = 'daily' | 'weekly' | 'monthly';
type DateRangeOpt = 'yesterday' | 'last_7' | 'last_30' | 'last_90' | 'this_month';
type FormatOpt = 'excel' | 'pdf';

interface Schedule {
  id?: string;
  frequency: Frequency;
  dayOfWeek?: number | null;    // 0=Sun..6=Sat for weekly
  dayOfMonth?: number | null;   // 1-28 for monthly
  deliveryHour: number;         // 0-23
  email: string;
  dateRange: DateRangeOpt;
  format: FormatOpt;
  active: boolean;
  timezone: string;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DATE_RANGE_OPTS: { value: DateRangeOpt; label: string }[] = [
  { value: 'yesterday',  label: 'Yesterday' },
  { value: 'last_7',    label: 'Last 7 days' },
  { value: 'last_30',   label: 'Last 30 days' },
  { value: 'last_90',   label: 'Last 90 days' },
  { value: 'this_month', label: 'This month' },
];

// ─── Auth fetch ───────────────────────────────────────────────────────────────

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken();
  return fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

// ─── Next delivery preview ────────────────────────────────────────────────────

function nextDeliveryLabel(schedule: Schedule): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const timeStr = `${schedule.deliveryHour % 12 || 12}:00 ${schedule.deliveryHour < 12 ? 'AM' : 'PM'}`;

  if (schedule.frequency === 'daily') {
    const tomorrow = addDays(now, 1);
    return `Tomorrow at ${timeStr}`;
  }
  if (schedule.frequency === 'weekly') {
    const dow = schedule.dayOfWeek ?? 1;
    const currentDow = now.getDay();
    let daysUntil = (dow - currentDow + 7) % 7;
    if (daysUntil === 0) daysUntil = 7;
    const target = addDays(now, daysUntil);
    return `Next ${DAYS_OF_WEEK[dow]} (${format(target, 'MMM d')}) at ${timeStr}`;
  }
  if (schedule.frequency === 'monthly') {
    const day = schedule.dayOfMonth ?? 1;
    return `On the ${day}${day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'} of next month at ${timeStr}`;
  }
  return '';
}

// ─── Main modal ───────────────────────────────────────────────────────────────

interface ScheduleReportModalProps {
  reportId: string;
  reportName: string;
  onClose: () => void;
  onSaved?: () => void;
  onDeleted?: () => void;
}

export default function ScheduleReportModal({ reportId, reportName, onClose, onSaved, onDeleted }: ScheduleReportModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const auth = getAuth();
  const userEmail = auth.currentUser?.email ?? '';

  const [schedule, setSchedule] = useState<Schedule>({
    frequency: 'daily',
    dayOfWeek: 1,
    dayOfMonth: 1,
    deliveryHour: 8,
    email: userEmail,
    dateRange: 'last_7',
    format: 'excel',
    active: true,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  const [existingId, setExistingId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    authFetch(`/api/schedules?reportId=${reportId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const existing = data?.schedule ?? (Array.isArray(data) ? data[0] : null);
        if (existing) {
          setExistingId(existing.id);
          setSchedule({
            frequency: existing.frequency ?? 'daily',
            dayOfWeek: existing.dayOfWeek ?? 1,
            dayOfMonth: existing.dayOfMonth ?? 1,
            deliveryHour: existing.deliveryHour ?? 8,
            email: existing.email ?? userEmail,
            dateRange: existing.dateRange ?? 'last_7',
            format: existing.format ?? 'excel',
            active: existing.active ?? true,
            timezone: existing.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [reportId, userEmail]);

  function update(patch: Partial<Schedule>) {
    setSchedule(prev => ({ ...prev, ...patch }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const body = { ...schedule, reportId };
      const res = existingId
        ? await authFetch(`/api/schedules/${existingId}`, { method: 'PATCH', body: JSON.stringify(body) })
        : await authFetch('/api/schedules/create', { method: 'POST', body: JSON.stringify(body) });
      if (res.ok) {
        const data = await res.json();
        if (data?.id) setExistingId(data.id);
        onSaved?.();
        setToast('Schedule saved');
        setTimeout(() => { setToast(null); onClose(); }, 1500);
      } else {
        setError('Failed to save schedule. Please try again.');
      }
    } catch {
      setError('Failed to save schedule.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!existingId) return;
    if (!confirm('Delete this schedule? This cannot be undone.')) return;
    const res = await authFetch(`/api/schedules/${existingId}`, { method: 'DELETE' });
    if (res.ok) {
      onDeleted?.();
      setToast('Schedule deleted');
      setTimeout(() => { setToast(null); onClose(); }, 1500);
    }
  }

  async function handleTestSend() {
    if (!existingId) return;
    setTestSending(true);
    try {
      const res = await authFetch(`/api/schedules/${existingId}/send-now`, { method: 'POST' });
      if (res.ok) {
        setToast(`Test email sent to ${schedule.email}`);
        setTimeout(() => setToast(null), 3000);
      }
    } finally {
      setTestSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Schedule Report</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-xs">{reportName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* Frequency */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Frequency</label>
                <div className="flex border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 p-0.5 gap-0.5">
                  {(['daily', 'weekly', 'monthly'] as Frequency[]).map(f => (
                    <button
                      key={f}
                      onClick={() => update({ frequency: f })}
                      disabled={saving}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                        schedule.frequency === f
                          ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                {schedule.frequency === 'weekly' && (
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Day of week</label>
                    <div className="flex gap-1">
                      {DAYS_OF_WEEK.map((d, i) => (
                        <button
                          key={i}
                          onClick={() => update({ dayOfWeek: i })}
                          disabled={saving}
                          className={`flex-1 py-1 text-xs rounded-md border transition-colors ${
                            schedule.dayOfWeek === i
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {schedule.frequency === 'monthly' && (
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Day of month (1–28)</label>
                    <input
                      type="number"
                      min={1}
                      max={28}
                      value={schedule.dayOfMonth ?? 1}
                      onChange={e => update({ dayOfMonth: Math.min(28, Math.max(1, Number(e.target.value))) })}
                      disabled={saving}
                      className="w-20 text-sm px-2.5 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                )}

                <p className="text-xs text-gray-400 italic">
                  Next delivery: {nextDeliveryLabel(schedule)}
                </p>
              </div>

              {/* Delivery hour */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Delivery hour</label>
                <select
                  value={schedule.deliveryHour}
                  onChange={e => update({ deliveryHour: Number(e.target.value) })}
                  disabled={saving}
                  className="w-full text-sm px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Delivery email</label>
                <input
                  type="email"
                  value={schedule.email}
                  onChange={e => update({ email: e.target.value })}
                  disabled={saving}
                  className="w-full text-sm px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>

              {/* Date range + format */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Date range</label>
                  <select
                    value={schedule.dateRange}
                    onChange={e => update({ dateRange: e.target.value as DateRangeOpt })}
                    disabled={saving}
                    className="w-full text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                  >
                    {DATE_RANGE_OPTS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Format</label>
                  <div className="flex border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 p-0.5">
                    {(['excel', 'pdf'] as FormatOpt[]).map(f => (
                      <button
                        key={f}
                        onClick={() => update({ format: f })}
                        disabled={saving}
                        className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors ${
                          schedule.format === f
                            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {f === 'excel' ? 'Excel' : 'PDF'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Active</label>
                <button
                  onClick={() => update({ active: !schedule.active })}
                  disabled={saving}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    schedule.active ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    schedule.active ? 'translate-x-5' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              {/* Advanced — timezone */}
              <div>
                <button
                  onClick={() => setAdvancedOpen(o => !o)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
                  Advanced
                </button>
                {advancedOpen && (
                  <div className="mt-2 space-y-1">
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Timezone override (IANA)</label>
                    <input
                      type="text"
                      value={schedule.timezone}
                      onChange={e => update({ timezone: e.target.value })}
                      disabled={saving}
                      placeholder="America/New_York"
                      className="w-full text-xs px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                    />
                  </div>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              {/* Toast */}
              {toast && (
                <div className="text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">
                  {toast}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-200 dark:border-gray-700 gap-2">
          <div className="flex gap-2">
            {existingId && (
              <>
                <button
                  onClick={handleDelete}
                  disabled={saving || loading}
                  className="text-xs text-red-500 hover:text-red-600 font-medium transition-colors disabled:opacity-50"
                >
                  Delete Schedule
                </button>
                <button
                  onClick={handleTestSend}
                  disabled={testSending || saving || loading}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 border border-gray-300 dark:border-gray-600 px-2 py-1 rounded-lg disabled:opacity-50"
                >
                  {testSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  Test Now
                </button>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              Save Schedule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
