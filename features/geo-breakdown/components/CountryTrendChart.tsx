'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { GeoSnapshotDayPoint } from '../types';

interface CountryTrendChartProps {
  data: GeoSnapshotDayPoint[];
}

export default function CountryTrendChart({ data }: CountryTrendChartProps) {
  // Filter out fully-null entries for display but keep date for X axis
  const chartData = data.map(point => ({
    date: point.date,
    netProfit: point.netProfit, // null values will create gaps
  }));

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,163,175,0.3)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip
            formatter={(value) => {
              const v = typeof value === 'number' ? value : null;
              return v != null ? [`$${v.toFixed(2)}`, 'Net Profit'] : ['—', 'Net Profit'];
            }}
          />
          <Line
            type="monotone"
            dataKey="netProfit"
            stroke="#6366f1"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
