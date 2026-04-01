'use client';

import {
  LineChart, Line, ReferenceLine, ResponsiveContainer, Tooltip,
} from 'recharts';

interface SparkPoint {
  date: string;
  actual: number | null;
  historicalAverage: number | null;
}

interface BenchmarkSparklineProps {
  data: SparkPoint[];
  unit: string;
}

export default function BenchmarkSparkline({ data, unit }: BenchmarkSparklineProps) {
  const hasData = data && data.length > 0 && data.some(d => d.actual !== null);

  if (!hasData) {
    return <div className="h-[120px] w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />;
  }

  const avgValue = data.find(d => d.historicalAverage !== null)?.historicalAverage ?? null;

  return (
    <div className="h-[120px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Tooltip
            formatter={(v) => {
              const n = typeof v === 'number' ? v : null;
              if (n == null) return ['—', ''];
              return [`${unit === '$' ? '$' : ''}${n.toFixed(2)}${unit === '%' ? '%' : ''}`, ''];
            }}
            labelFormatter={() => ''}
          />
          {avgValue !== null && (
            <ReferenceLine y={avgValue} stroke="#9ca3af" strokeDasharray="4 4" />
          )}
          <Line
            type="monotone"
            dataKey="actual"
            stroke="#6366f1"
            strokeWidth={1.5}
            dot={false}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
