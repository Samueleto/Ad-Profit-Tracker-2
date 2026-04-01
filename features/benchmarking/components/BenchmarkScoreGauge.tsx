'use client';

import { formatDistanceToNow } from 'date-fns';

interface BenchmarkScoreGaugeProps {
  score: number | null;
  computedAt?: string | null;
}

function scoreColor(score: number): { stroke: string; text: string } {
  if (score >= 80) return { stroke: '#22c55e', text: 'text-green-600 dark:text-green-400' };
  if (score >= 50) return { stroke: '#f59e0b', text: 'text-amber-500 dark:text-amber-400' };
  return { stroke: '#ef4444', text: 'text-red-500 dark:text-red-400' };
}

export default function BenchmarkScoreGauge({ score, computedAt }: BenchmarkScoreGaugeProps) {
  if (score === null || score === undefined) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="w-28 h-28 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    );
  }

  const { stroke, text } = scoreColor(score);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, score)) / 100;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-28 h-28">
        <svg className="w-28 h-28 -rotate-90" viewBox="0 0 112 112">
          {/* Track */}
          <circle cx="56" cy="56" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="8" className="dark:stroke-gray-700" />
          {/* Progress */}
          <circle
            cx="56" cy="56" r={radius}
            fill="none"
            stroke={stroke}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${text}`}>{score}</span>
          <span className="text-xs text-gray-400">/100</span>
        </div>
      </div>
      {computedAt && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Updated {formatDistanceToNow(new Date(computedAt), { addSuffix: true })}
        </p>
      )}
    </div>
  );
}
