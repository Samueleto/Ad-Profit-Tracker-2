'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useROIThresholds } from '../hooks/useROI';
import { Toast } from '@/components/ui/Toast';

interface ROIThresholdsPanelProps {
  onClose: () => void;
}

export default function ROIThresholdsPanel({ onClose }: ROIThresholdsPanelProps) {
  const { thresholds, usingDefaults, isSaving, isLoading, error, validationError, updateThresholds } = useROIThresholds();

  const [positiveThreshold, setPositiveThreshold] = useState('');
  const [warningThreshold, setWarningThreshold] = useState('');
  const [criticalThreshold, setCriticalThreshold] = useState('');
  const [targetRoi, setTargetRoi] = useState('');
  const [alertOnNegative, setAlertOnNegative] = useState(false);
  const [alertOnTargetMiss, setAlertOnTargetMiss] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Seed form once thresholds load
  useEffect(() => {
    if (!thresholds) return;
    setPositiveThreshold(String(thresholds.positiveThreshold));
    setWarningThreshold(String(thresholds.warningThreshold));
    setCriticalThreshold(String(thresholds.criticalThreshold));
    setTargetRoi(thresholds.targetRoi != null ? String(thresholds.targetRoi) : '');
    setAlertOnNegative(thresholds.alertOnNegative);
    setAlertOnTargetMiss(thresholds.alertOnTargetMiss);
  }, [thresholds]);

  const isDefault = (field: string) => usingDefaults.includes(field);

  // Inline ordering validation
  const pos = parseFloat(positiveThreshold);
  const warn = parseFloat(warningThreshold);
  const crit = parseFloat(criticalThreshold);
  let inlineError: string | null = null;
  if (!isNaN(crit) && !isNaN(warn) && crit > warn) {
    inlineError = 'Critical threshold must be ≤ warning threshold.';
  } else if (!isNaN(warn) && !isNaN(pos) && warn > pos) {
    inlineError = 'Warning threshold must be ≤ positive threshold.';
  }

  const handleSave = async () => {
    if (inlineError) return;
    setSaveError(null);
    try {
      await updateThresholds({
        positiveThreshold: isNaN(pos) ? undefined : pos,
        warningThreshold: isNaN(warn) ? undefined : warn,
        criticalThreshold: isNaN(crit) ? undefined : crit,
        targetRoi: targetRoi === '' ? null : parseFloat(targetRoi),
        alertOnNegative,
        alertOnTargetMiss,
      } as Parameters<typeof updateThresholds>[0]);
      setSaveSuccess(true);
      setTimeout(onClose, 1200);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save thresholds.');
    }
  };

  const fieldClass = 'w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Configure ROI Thresholds</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <X className="w-4 h-4" />
        </button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-8 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />)}
        </div>
      )}

      {!isLoading && (
        <div className="space-y-3">
          {/* positiveThreshold */}
          <div>
            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mb-1">
              Positive threshold (%)
              {isDefault('positiveThreshold') && (
                <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded text-[10px]">default</span>
              )}
            </label>
            <input type="number" value={positiveThreshold} onChange={e => setPositiveThreshold(e.target.value)} className={fieldClass} />
          </div>

          {/* warningThreshold */}
          <div>
            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mb-1">
              Warning threshold (%)
              {isDefault('warningThreshold') && (
                <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded text-[10px]">default</span>
              )}
            </label>
            <input type="number" value={warningThreshold} onChange={e => setWarningThreshold(e.target.value)} className={fieldClass} />
          </div>

          {/* criticalThreshold */}
          <div>
            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mb-1">
              Critical threshold (%)
              {isDefault('criticalThreshold') && (
                <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded text-[10px]">default</span>
              )}
            </label>
            <input type="number" value={criticalThreshold} onChange={e => setCriticalThreshold(e.target.value)} className={fieldClass} />
          </div>

          {/* targetRoi */}
          <div>
            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mb-1">
              Target ROI (%) — optional
              {isDefault('targetRoi') && (
                <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded text-[10px]">default</span>
              )}
            </label>
            <input type="number" value={targetRoi} onChange={e => setTargetRoi(e.target.value)} placeholder="e.g. 50" className={fieldClass} />
          </div>

          {/* alertOnNegative */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={alertOnNegative}
              onChange={e => setAlertOnNegative(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600"
            />
            <span className="text-xs text-gray-700 dark:text-gray-300">
              Alert on negative ROI
              {isDefault('alertOnNegative') && (
                <span className="ml-2 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded text-[10px]">default</span>
              )}
            </span>
          </label>

          {/* alertOnTargetMiss */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={alertOnTargetMiss}
              onChange={e => setAlertOnTargetMiss(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600"
            />
            <span className="text-xs text-gray-700 dark:text-gray-300">
              Alert when ROI misses target
              {isDefault('alertOnTargetMiss') && (
                <span className="ml-2 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded text-[10px]">default</span>
              )}
            </span>
          </label>

          {/* Validation / server errors */}
          {(inlineError || validationError || saveError || error) && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {inlineError ?? validationError ?? saveError ?? error}
            </p>
          )}

          <button
            onClick={handleSave}
            disabled={isSaving || !!inlineError}
            className="w-full py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {isSaving ? 'Saving…' : 'Save thresholds'}
          </button>
        </div>
      )}

      {saveSuccess && <Toast message="Thresholds saved successfully." variant="success" onClose={() => setSaveSuccess(false)} />}
    </div>
  );
}
