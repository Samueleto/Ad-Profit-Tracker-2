'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { getAuth } from 'firebase/auth';
import { Sun, Moon, Monitor, Check, Loader2 } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ThemeMode = 'light' | 'dark' | 'system';

const ACCENT_PRESETS: { name: string; hex: string }[] = [
  { name: 'indigo',   hex: '#6366f1' },
  { name: 'emerald',  hex: '#10b981' },
  { name: 'rose',     hex: '#f43f5e' },
  { name: 'amber',    hex: '#f59e0b' },
  { name: 'sky',      hex: '#0ea5e9' },
  { name: 'violet',   hex: '#8b5cf6' },
  { name: 'orange',   hex: '#f97316' },
  { name: 'slate',    hex: '#64748b' },
];

const DEFAULT_THEME: ThemeMode = 'light';
const DEFAULT_ACCENT = '#6366f1';

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

// ─── Hex validation ───────────────────────────────────────────────────────────

function isValidHex(hex: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(hex);
}

function sanitizeHex(hex: string): string {
  // Only allow valid hex color strings to prevent CSS injection
  return isValidHex(hex) ? hex : DEFAULT_ACCENT;
}

// ─── Live preview ─────────────────────────────────────────────────────────────

function LivePreview({ accent, dark }: { accent: string; dark: boolean }) {
  const safe = sanitizeHex(accent);
  return (
    <div
      className={`rounded-xl p-4 border ${dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}
      style={{ minHeight: 120 }}
    >
      <div className={`text-xs font-semibold mb-1 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
        Net Profit — 30d
      </div>
      <div className="text-2xl font-bold mb-2" style={{ color: safe }}>
        $4,821.00
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
          <div className="h-full rounded-full" style={{ width: '72%', backgroundColor: safe }} />
        </div>
        <span className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>+12.4%</span>
      </div>
      <div
        className="mt-2 inline-block text-xs px-2 py-0.5 rounded-full text-white"
        style={{ backgroundColor: safe }}
      >
        Preview
      </div>
    </div>
  );
}

// ─── Main section ─────────────────────────────────────────────────────────────

export default function ThemeSettingsSection() {
  const { setTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>(DEFAULT_THEME);
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT);
  const [showCustom, setShowCustom] = useState(false);
  const [customHex, setCustomHex] = useState('');
  const [customError, setCustomError] = useState('');

  // Apply accent CSS var immediately
  useEffect(() => {
    const safe = sanitizeHex(accentColor);
    document.documentElement.style.setProperty('--accent-color', safe);
  }, [accentColor]);

  // Apply theme immediately
  useEffect(() => {
    setTheme(themeMode);
  }, [themeMode, setTheme]);

  // Load saved preferences
  useEffect(() => {
    authFetch('/api/settings/preferences')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          if (data.themePreference) setThemeMode(data.themePreference as ThemeMode);
          if (data.accentColor) setAccentColor(data.accentColor);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await authFetch('/api/settings/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ themePreference: themeMode, accentColor }),
      });
      if (res.ok) {
        setToast('Saved');
        setTimeout(() => setToast(null), 3000);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setThemeMode(DEFAULT_THEME);
    setAccentColor(DEFAULT_ACCENT);
    setShowCustom(false);
    setCustomHex('');
    await authFetch('/api/settings/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ themePreference: DEFAULT_THEME, accentColor: DEFAULT_ACCENT }),
    }).catch(() => {});
  }

  function handleCustomHexChange(val: string) {
    setCustomHex(val);
    if (val === '') {
      setCustomError('');
      return;
    }
    const withHash = val.startsWith('#') ? val : `#${val}`;
    if (isValidHex(withHash)) {
      setCustomError('');
      setAccentColor(withHash);
    } else {
      setCustomError('Enter a valid 6-digit hex color (e.g. #a3b4c5)');
    }
  }

  const isDark = themeMode === 'dark';

  const THEME_OPTIONS: { id: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { id: 'light',  label: 'Light',  icon: <Sun className="w-4 h-4" /> },
    { id: 'dark',   label: 'Dark',   icon: <Moon className="w-4 h-4" /> },
    { id: 'system', label: 'System', icon: <Monitor className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-1">Appearance</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Customize the look and feel of your dashboard.</p>
      </div>

      {/* Theme mode */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Theme Mode</label>
        {loading ? (
          <div className="h-10 w-64 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
        ) : (
          <div className="inline-flex rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-1 gap-1">
            {THEME_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => setThemeMode(opt.id)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  themeMode === opt.id
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Accent color */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Accent Color</label>
        {loading ? (
          <div className="flex gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 items-center">
            {ACCENT_PRESETS.map(p => (
              <button
                key={p.name}
                onClick={() => { setAccentColor(p.hex); setShowCustom(false); }}
                title={p.name}
                className="relative w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2"
                style={{
                  backgroundColor: p.hex,
                  borderColor: accentColor === p.hex ? p.hex : 'transparent',
                }}
              >
                {accentColor === p.hex && (
                  <Check className="absolute inset-0 m-auto w-4 h-4 text-white drop-shadow" />
                )}
              </button>
            ))}
            <button
              onClick={() => setShowCustom(c => !c)}
              className="px-3 py-1 text-xs font-medium border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Custom
            </button>
          </div>
        )}

        {showCustom && !loading && (
          <div className="flex items-center gap-2 mt-2">
            <input
              type="text"
              value={customHex}
              onChange={e => handleCustomHexChange(e.target.value)}
              placeholder="#a3b4c5"
              maxLength={7}
              className="font-mono text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-32"
            />
            {customHex && !customError && (
              <div className="w-6 h-6 rounded-full border border-gray-200" style={{ backgroundColor: accentColor }} />
            )}
            {customError && <p className="text-xs text-red-500">{customError}</p>}
          </div>
        )}
      </div>

      {/* Live preview */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Live Preview</label>
        <div className="max-w-xs">
          <LivePreview accent={accentColor} dark={isDark} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Save Appearance
        </button>
        <button
          onClick={handleReset}
          disabled={saving}
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline transition-colors"
        >
          Reset to Defaults
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-green-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
