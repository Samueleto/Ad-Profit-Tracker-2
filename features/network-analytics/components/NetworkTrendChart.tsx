'use client';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts';

interface SeriesPoint {
  date: string;
  value: number | null;
}

interface NetworkTrendChartProps {
  series: SeriesPoint[];
  dataRole: 'cost' | 'revenue';
  isLoading?: boolean;
}

const FILL_COLOR = {
  cost: '#F59E0B',
  revenue: '#10B981',
};

export default function NetworkTrendChart({ series, dataRole, isLoading }: NetworkTrendChartProps) {
  const color = FILL_COLOR[dataRole];
  const fillOpacity = 0.2;

  if (isLoading) {
    return <div className="h-[280px] w-full bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />;
  }

  if (!series || series.length === 0) {
    return (
      <div className="h-[280px] w-full flex items-center justify-center text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        No trend data available
      </div>
    );
  }

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,163,175,0.3)" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
          <Tooltip formatter={(v) => {
            const n = typeof v === 'number' ? v : null;
            return n != null ? [`$${n.toFixed(2)}`, dataRole === 'cost' ? 'Cost' : 'Revenue'] : ['—', ''];
          }} />
          <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="4 4" label={{ value: 'Breakeven', position: 'right', fontSize: 10, fill: '#9ca3af' }} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            fill={color}
            fillOpacity={fillOpacity}
            connectNulls={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
