'use client';

import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import type { OverallHealth } from '../types';
import { healthDisplay } from '../utils';

interface HealthBannerProps {
  overallHealth: OverallHealth;
}

const ICONS: Record<OverallHealth, React.ElementType> = {
  healthy: CheckCircle,
  degraded: AlertTriangle,
  critical: XCircle,
};

const DARK_COLORS: Record<OverallHealth, string> = {
  healthy: 'dark:bg-green-900/20 dark:text-green-300 dark:border-green-800',
  degraded: 'dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
  critical: 'dark:bg-red-900/20 dark:text-red-300 dark:border-red-800',
};

export default function HealthBanner({ overallHealth }: HealthBannerProps) {
  const { bannerText, colorClass, bgClass } = healthDisplay(overallHealth);
  const Icon = ICONS[overallHealth];
  const darkClass = DARK_COLORS[overallHealth];

  return (
    <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium ${bgClass} ${colorClass} ${darkClass}`}>
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span>{bannerText}</span>
    </div>
  );
}
