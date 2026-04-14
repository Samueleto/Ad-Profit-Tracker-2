'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth } from 'firebase/auth';
import { ChevronDown } from 'lucide-react';
import NotificationToggleRow, { type NotificationTypeConfig } from './NotificationToggleRow';
import MasterEmailToggle from './MasterEmailToggle';
import DeliveryEmailField from './DeliveryEmailField';
import SendTestButton from './SendTestButton';
import EmailLogTable from './EmailLogTable';
import { toast } from 'sonner';

// ─── Notification type definitions ───────────────────────────────────────────

type AlertType =
  | 'sync_failure'
  | 'reconciliation_anomaly'
  | 'circuit_breaker_opened'
  | 'sync_success'
  | 'export_complete'
  | 'export_failure'
  | 'schedule_delivered'
  | 'schedule_failed'
  | 'rate_limit_exceeded';

const CRITICAL_ALERTS: { type: AlertType; config: NotificationTypeConfig }[] = [
  {
    type: 'sync_failure',
    config: { label: 'Sync Failure', description: 'Fires when a data sync fails', severity: 'error', isCritical: true },
  },
  {
    type: 'reconciliation_anomaly',
    config: { label: 'Reconciliation Anomaly', description: 'Fires when a reconciliation anomaly is detected', severity: 'warning', isCritical: true },
  },
  {
    type: 'circuit_breaker_opened',
    config: { label: 'Circuit Breaker Opened', description: 'Fires when a circuit breaker trips open', severity: 'error', isCritical: true },
  },
];

const INFORMATIONAL_ALERTS: { type: AlertType; config: NotificationTypeConfig }[] = [
  {
    type: 'sync_success',
    config: { label: 'Sync Success', description: 'Fires when a data sync completes successfully', severity: 'success' },
  },
  {
    type: 'export_complete',
    config: { label: 'Export Complete', description: 'Fires when a report export is ready for download', severity: 'info' },
  },
  {
    type: 'export_failure',
    config: { label: 'Export Failure', description: 'Fires when a report export fails', severity: 'error' },
  },
  {
    type: 'schedule_delivered',
    config: { label: 'Schedule Delivered', description: 'Fires when a scheduled report is delivered', severity: 'success' },
  },
  {
    type: 'schedule_failed',
    config: { label: 'Schedule Failed', description: 'Fires when a scheduled report fails to deliver', severity: 'error' },
  },
  {
    type: 'rate_limit_exceeded',
    config: { label: 'Rate Limit Exceeded', description: 'Fires when an API rate limit is exceeded', severity: 'warning' },
  },
];

const ALL_ALERTS = [...CRITICAL_ALERTS, ...INFORMATIONAL_ALERTS];

type ToggleStates = Record<AlertType, boolean>;
type SaveStates = Record<AlertType, 'idle' | 'saving' | 'saved' | 'error'>;

// ─── Auth fetch ───────────────────────────────────────────────────────────────

async function authFetch(path: string, init: RequestInit = {}, refresh = false): Promise<Response> {
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken(refresh);
  return fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

// ─── Main section ─────────────────────────────────────────────────────────────

export default function EmailAlertPreferencesSection() {
  const router = useRouter();
  const auth = getAuth();
  const userEmail = auth.currentUser?.email ?? '';

  const [loading, setLoading] = useState(true);
  const [toggleStates, setToggleStates] = useState<ToggleStates>(() => {
    const init = {} as ToggleStates;
    ALL_ALERTS.forEach(a => { init[a.type] = false; });
    return init;
  });
  const [saveStates, setSaveStates] = useState<SaveStates>(() => {
    const init = {} as SaveStates;
    ALL_ALERTS.forEach(a => { init[a.type] = 'idle'; });
    return init;
  });

  // Email field state
  const [alertEmail, setAlertEmail] = useState(userEmail);
  const [initialEmail, setInitialEmail] = useState(userEmail);
  const [emailSaveState, setEmailSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Test button state
  const [testLoading, setTestLoading] = useState(false);
  const [lastTestSentAt, setLastTestSentAt] = useState<string | null>(null);

  // Advanced
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [smtpOverride, setSmtpOverride] = useState('');

  // Email delivery history
  const [historyOpen, setHistoryOpen] = useState(false);


  // Load preferences on mount
  useEffect(() => {
    (async () => {
      try {
        let res = await authFetch('/api/notifications/preferences');
        if (res.status === 401) {
          res = await authFetch('/api/notifications/preferences', {}, true);
          if (res.status === 401) {
            toast.error('Session expired. Please sign in again.');
            router.replace('/');
            return;
          }
        }
        const data = res.ok ? await res.json() : null;
        if (data) {
          const next = {} as ToggleStates;
          ALL_ALERTS.forEach(a => {
            next[a.type] = data?.emailAlerts?.[a.type]?.emailEnabled ?? false;
          });
          setToggleStates(next);
          const email = data.alertDeliveryEmail ?? userEmail;
          setAlertEmail(email);
          setInitialEmail(email);
          setLastTestSentAt(data.lastTestEmailSentAt ?? null);
          setSmtpOverride(data.smtpOverride ?? '');
        } else {
          setAlertEmail(userEmail);
          setInitialEmail(userEmail);
        }
      } catch {
        setAlertEmail(userEmail);
        setInitialEmail(userEmail);
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Toggle one alert type
  async function handleToggle(type: AlertType, enabled: boolean) {
    setToggleStates(prev => ({ ...prev, [type]: enabled }));
    setSaveStates(prev => ({ ...prev, [type]: 'saving' }));
    const toggleInit = { method: 'PATCH', body: JSON.stringify({ emailAlerts: { [type]: { emailEnabled: enabled } } }) };
    try {
      let res = await authFetch('/api/notifications/preferences', toggleInit);
      if (res.status === 401) {
        res = await authFetch('/api/notifications/preferences', toggleInit, true);
        if (res.status === 401) {
          toast.error('Session expired. Please sign in again.');
          router.replace('/');
          return;
        }
      }
      setSaveStates(prev => ({ ...prev, [type]: res.ok ? 'saved' : 'error' }));
      setTimeout(() => setSaveStates(prev => ({ ...prev, [type]: 'idle' })), 2000);
    } catch {
      setSaveStates(prev => ({ ...prev, [type]: 'error' }));
    }
  }

  // Master toggle
  const allEnabled = ALL_ALERTS.every(a => toggleStates[a.type]);
  const someEnabled = ALL_ALERTS.some(a => toggleStates[a.type]);

  async function handleMasterToggle(enabled: boolean) {
    const next = {} as ToggleStates;
    ALL_ALERTS.forEach(a => { next[a.type] = enabled; });
    setToggleStates(next);
    await authFetch('/api/notifications/preferences', {
      method: 'PATCH',
      body: JSON.stringify({
        emailAlerts: ALL_ALERTS.reduce((acc, a) => {
          acc[a.type] = { emailEnabled: enabled };
          return acc;
        }, {} as Record<string, { emailEnabled: boolean }>),
      }),
    }).catch(() => {});
  }

  // Save email
  async function handleSaveEmail() {
    setEmailSaveState('saving');
    const saveInit = { method: 'PATCH', body: JSON.stringify({ alertDeliveryEmail: alertEmail }) };
    try {
      let res = await authFetch('/api/notifications/preferences', saveInit);
      if (res.status === 401) {
        res = await authFetch('/api/notifications/preferences', saveInit, true);
        if (res.status === 401) {
          toast.error('Session expired. Please sign in again.');
          router.replace('/');
          return;
        }
      }
      if (res.ok) {
        setEmailSaveState('saved');
        setInitialEmail(alertEmail);
        setTimeout(() => setEmailSaveState('idle'), 2000);
      } else {
        setEmailSaveState('error');
      }
    } catch {
      setEmailSaveState('error');
    }
  }

  // Send test
  async function handleSendTest() {
    setTestLoading(true);
    try {
      const res = await authFetch('/api/email/send-test', { method: 'POST' });
      if (res.ok) {
        const now = new Date().toISOString();
        setLastTestSentAt(now);
        toast.success(`Test email sent to ${alertEmail}`);
      }
    } finally {
      setTestLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Email Alerts</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Configure which events trigger email notifications and where they&apos;re delivered.
        </p>
      </div>

      {/* Master toggle */}
      {loading ? (
        <div className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
      ) : (
        <MasterEmailToggle
          allEnabled={allEnabled}
          someEnabled={someEnabled}
          onChange={handleMasterToggle}
        />
      )}

      {/* Delivery email */}
      <DeliveryEmailField
        value={alertEmail}
        initialValue={initialEmail}
        onChange={setAlertEmail}
        onSave={handleSaveEmail}
        saveState={emailSaveState}
      />

      {/* Critical alerts */}
      <div>
        <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide mb-1 px-1">
          Critical Alerts
        </p>
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 animate-pulse" />
              ))
            : CRITICAL_ALERTS.map(({ type, config }) => (
                <NotificationToggleRow
                  key={type}
                  config={config}
                  emailEnabled={toggleStates[type]}
                  onChange={(v) => handleToggle(type, v)}
                  saveState={saveStates[type]}
                />
              ))
          }
        </div>
      </div>

      {/* Informational alerts */}
      <div>
        <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1 px-1">
          Informational
        </p>
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 animate-pulse" />
              ))
            : INFORMATIONAL_ALERTS.map(({ type, config }) => (
                <NotificationToggleRow
                  key={type}
                  config={config}
                  emailEnabled={toggleStates[type]}
                  onChange={(v) => handleToggle(type, v)}
                  saveState={saveStates[type]}
                />
              ))
          }
        </div>
      </div>

      {/* Test delivery */}
      <SendTestButton
        onClick={handleSendTest}
        isLoading={testLoading}
        lastTestSentAt={lastTestSentAt}
      />

      {/* Advanced options */}
      <div>
        <button
          onClick={() => setAdvancedOpen(o => !o)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
          Advanced Options
        </button>
        {advancedOpen && (
          <div className="mt-3 space-y-2 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Custom SMTP Override
            </label>
            <input
              type="text"
              value={smtpOverride}
              onChange={e => setSmtpOverride(e.target.value)}
              placeholder="smtp://user:pass@host:587"
              className="w-full text-xs px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-mono"
            />
            <p className="text-xs text-gray-400">Override the default SMTP server for this account.</p>
          </div>
        )}
      </div>

      {/* Email Delivery History */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <button
          onClick={() => setHistoryOpen(o => !o)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${historyOpen ? 'rotate-180' : ''}`} />
          Email Delivery History
        </button>
        {historyOpen && (
          <div className="mt-3">
            <EmailLogTable />
          </div>
        )}
      </div>

    </div>
  );
}
