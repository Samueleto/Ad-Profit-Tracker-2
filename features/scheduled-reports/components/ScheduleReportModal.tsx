'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { X, ChevronDown, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { getAuth } from 'firebase/auth';
import { useSchedule } from '../hooks/useSchedule';
import type { ScheduleFrequency, ScheduleFormat, ScheduleDatePreset } from '../types';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DATE_PRESETS: { value: ScheduleDatePreset; label: string }[] = [
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7', label: 'Last 7 days' },
  { value: 'last_30', label: 'Last 30 days' },
  { value: 'last_90', label: 'Last 90 days' },
  { value: 'this_month', label: 'This month' },
];

function computeNextDelivery(frequency: ScheduleFrequency, dayOfWeek: number, dayOfMonth: number): string {
  const now = new Date();
  const hour = 8;
  if (frequency === 'daily') {
    const next = new Date(now);
    next.setHours(hour, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    const isToday = next.toDateString() === now.toDateString();
    const isTomorrow = new Date(now.getTime() + 86400000).toDateString() === next.toDateString();
    if (isTomorrow || (!isToday)) return `Tomorrow at ${hour}:00 AM`;
    return `Today at ${hour}:00 AM`;
  }
  if (frequency === 'weekly') {
    const next = new Date(now);
    const diff = (dayOfWeek - now.getDay() + 7) % 7 || 7;
    next.setDate(now.getDate() + diff);
    next.setHours(hour, 0, 0, 0);
    return `Next ${DAYS_OF_WEEK[dayOfWeek]} at ${hour}:00 AM`;
  }
  // monthly
  const next = new Date(now.getFullYear(), now.getMonth(), dayOfMonth, hour);
  if (next <= now) next.setMonth(next.getMonth() + 1);
  return `${next.toLocaleString('default', { month: 'long' })} ${dayOfMonth} at ${hour}:00 AM`;
}

const TIMEZONES = Intl.supportedValuesOf('timeZone');

interface ScheduleReportModalProps {
  reportId: string;
  reportName: string;
  onClose: () => void;
}

export default function ScheduleReportModal({ reportId, reportName, onClose }: ScheduleReportModalProps) {
  const router = useRouter();
  const hook = useSchedule(reportId);

  const userEmail = getAuth().currentUser?.email ?? '';
  const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Form state
  const [frequency, setFrequency] = useState<ScheduleFrequency>('daily');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [email, setEmail] = useState(userEmail);
  const [emailError, setEmailError] = useState('');
  const [datePreset, setDatePreset] = useState<ScheduleDatePreset>('last_7');
  const [format, setFormat] = useState<ScheduleFormat>('excel');
  const [isActive, setIsActive] = useState(true);
  const [timezone, setTimezone] = useState(userTz);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    hook.fetchSchedule();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (hook.errorCode === 401) {
      onClose();
      router.push('/');
    }
  }, [hook.errorCode, onClose, router]);

  useEffect(() => {
    if (hook.schedule) {
      const s = hook.schedule;
      setFrequency(s.frequency);
      setDayOfWeek(s.dayOfWeek ?? 1);
      setDayOfMonth(s.dayOfMonth ?? 1);
      setEmail(s.deliveryEmail);
      setDatePreset(s.dateRangePreset);
      setFormat(s.format);
      setIsActive(s.isActive);
      setTimezone(s.timezone);
    }
  }, [hook.schedule]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !hook.saving) onClose();
  }, [hook.saving, onClose]);

  const validateEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const handleSave = async () => {
    if (!validateEmail(email)) { setEmailError('Invalid email address.'); return; }
    const input = {
      reportId,
      reportName,
      frequency,
      dayOfWeek: frequency === 'weekly' ? dayOfWeek : undefined,
      dayOfMonth: frequency === 'monthly' ? dayOfMonth : undefined,
      deliveryHour: 8,
      timezone,
      deliveryEmail: email,
      dateRangePreset: datePreset,
      format,
      isActive,
    };
    const ok = await hook.saveSchedule(input, hook.schedule?.id);
    if (ok) {
      toast.success('Schedule saved');
      setTimeout(() => onClose(), 1500);
    }
  };

  const handleDelete = async () => {
    if (!hook.schedule) return;
    const ok = await hook.deleteSchedule(hook.schedule.id);
    if (ok) {
      toast.success('Schedule deleted');
      setTimeout(() => onClose(), 1000);
    }
  };

  const nextDelivery = computeNextDelivery(frequency, dayOfWeek, dayOfMonth);
  const isEditing = !!hook.schedule;
  const disabled = hook.saving;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => { if (!hook.saving) onClose(); }}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Schedule Report</h2>
          <button onClick={() => { if (!hook.saving) onClose(); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* Error states */}
          {hook.errorCode === 403 && (
            <div className="text-center py-4">
              <p className="text-sm text-red-600 dark:text-red-400 mb-2">Access Denied</p>
              <button onClick={onClose} className="text-xs text-blue-600 underline">Close</button>
            </div>
          )}
          {hook.errorCode === 404 && (
            <div className="text-center py-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Report not found</p>
              <button onClick={onClose} className="text-xs text-blue-600 underline">Close</button>
            </div>
          )}
          {hook.error && hook.errorCode === 500 && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex items-center gap-1 text-xs text-red-700 dark:text-red-300">
                <span>{hook.error}</span>
                <button onClick={() => { hook.clearError(); hook.fetchSchedule(); }} className="underline ml-1">Retry</button>
              </div>
            </div>
          )}

          {/* Loading shimmer */}
          {hook.loading && (
            <div className="space-y-3 animate-pulse">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg" />
              ))}
            </div>
          )}

          {/* Form */}
          {!hook.loading && hook.errorCode !== 403 && hook.errorCode !== 404 && (
            <>
              {/* Report name */}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Scheduling: <span className="font-medium text-gray-700 dark:text-gray-300">{reportName}</span>
              </p>

              {/* Frequency */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Frequency</label>
                <div className="inline-flex rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-0.5 gap-0.5">
                  {(['daily', 'weekly', 'monthly'] as ScheduleFrequency[]).map(f => (
                    <button
                      key={f}
                      onClick={() => setFrequency(f)}
                      disabled={disabled}
                      className={`px-4 py-1.5 text-xs font-medium rounded-full capitalize transition-colors ${
                        frequency === f
                          ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                {frequency === 'weekly' && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {DAYS_OF_WEEK.map((d, i) => (
                      <button
                        key={d}
                        onClick={() => setDayOfWeek(i)}
                        disabled={disabled}
                        className={`w-8 h-8 text-xs font-medium rounded-full border transition-colors ${
                          dayOfWeek === i
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                )}

                {frequency === 'monthly' && (
                  <div className="mt-2">
                    <select
                      value={dayOfMonth}
                      onChange={e => setDayOfMonth(Number(e.target.value))}
                      disabled={disabled}
                      className="px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                        <option key={d} value={d}>Day {d}</option>
                      ))}
                    </select>
                  </div>
                )}

                <p className="mt-1.5 text-xs text-gray-400">Next delivery: {nextDelivery}</p>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Delivery Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setEmailError(''); }}
                  onBlur={() => { if (!validateEmail(email)) setEmailError('Invalid email address.'); }}
                  disabled={disabled}
                  className="w-full px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {emailError && <p className="mt-1 text-xs text-red-500">{emailError}</p>}
              </div>

              {/* Date preset + Format */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Date Range</label>
                  <select
                    value={datePreset}
                    onChange={e => setDatePreset(e.target.value as ScheduleDatePreset)}
                    disabled={disabled}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {DATE_PRESETS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Format</label>
                  <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-0.5 gap-0.5">
                    {(['excel', 'pdf'] as ScheduleFormat[]).map(f => (
                      <button
                        key={f}
                        onClick={() => setFormat(f)}
                        disabled={disabled}
                        className={`px-3 py-1 text-xs font-medium rounded-md uppercase transition-colors ${
                          format === f
                            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Active toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => !disabled && setIsActive(v => !v)}
                  className={`relative w-8 h-4 rounded-full transition-colors cursor-pointer ${isActive ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${isActive ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-xs text-gray-700 dark:text-gray-300">Active</span>
              </label>

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
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Timezone</label>
                    <select
                      value={timezone}
                      onChange={e => setTimezone(e.target.value)}
                      disabled={disabled}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {TIMEZONES.map(tz => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Send Test Now */}
              {isEditing && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => hook.schedule && hook.sendNow(hook.schedule.id)}
                    disabled={hook.sendTestLoading || disabled}
                    className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-60"
                  >
                    {hook.sendTestLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                    Send Test Now
                  </button>
                  {hook.sendTestMessage && (
                    <span className={`text-xs ${hook.sendTestMessage.includes('sent') ? 'text-green-600' : 'text-red-500'}`}>
                      {hook.sendTestMessage}
                    </span>
                  )}
                </div>
              )}

            </>
          )}
        </div>

        {/* Footer */}
        {!hook.loading && hook.errorCode !== 403 && hook.errorCode !== 404 && (
          <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
            <div>
              {isEditing && !confirmDelete && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  disabled={disabled}
                  className="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-60"
                >
                  Delete Schedule
                </button>
              )}
              {confirmDelete && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 dark:text-gray-400">Are you sure?</span>
                  <button onClick={handleDelete} disabled={disabled} className="text-xs text-red-600 font-medium hover:underline">
                    {hook.saving ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Yes, delete'}
                  </button>
                  <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                </div>
              )}
            </div>
            <button
              onClick={handleSave}
              disabled={disabled}
              className="flex items-center gap-2 px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {hook.saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Schedule
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
