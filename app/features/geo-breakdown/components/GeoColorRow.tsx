'use client';

import { ReactNode } from 'react';

interface GeoColorRowProps {
  colorCode: string;
  children: ReactNode;
  className?: string;
}

export default function GeoColorRow({ colorCode, children, className = '' }: GeoColorRowProps) {
  const colorClass = colorCode === 'positive'
    ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
    : colorCode === 'negative'
    ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
    : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400';

  return (
    <tr className={`${colorClass} ${className}`}>
      {children}
    </tr>
  );
}
