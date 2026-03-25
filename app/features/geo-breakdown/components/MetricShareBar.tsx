'use client';

interface MetricShareBarProps {
  value: number; // 0-100
}

export default function MetricShareBar({ value }: MetricShareBarProps) {
  const clampedValue = Math.max(0, Math.min(100, value));
  return (
    <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div
        className="h-full bg-blue-500 rounded-full"
        style={{ width: `${clampedValue}%` }}
      />
    </div>
  );
}
