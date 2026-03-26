'use client';

import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';

interface DailyPoint {
  date: string;
  revenue: number;
  cost: number;
  netProfit: number;
}

interface ProfitTrendChartProps {
  data: DailyPoint[];
  isLoading?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as DailyPoint;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg text-xs space-y-1">
      <p className="font-semibold text-gray-900 dark:text-gray-100">{label}</p>
      <p>Revenue: <span className="font-medium">${d.revenue.toFixed(2)}</span></p>
      <p>Cost: <span className="font-medium">${d.cost.toFixed(2)}</span></p>
      <p>Net Profit: <span className={`font-medium ${d.netProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>${d.netProfit.toFixed(2)}</span></p>
    </div>
  );
}

export default function ProfitTrendChart({ data, isLoading }: ProfitTrendChartProps) {
  if (isLoading) {
    return <div className="h-56 w-full bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />;
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,163,175,0.3)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={d => { try { return format(parseISO(d), 'MMM d'); } catch { return d; } }}
          />
          <YAxis
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `$${v}`}
          />
          <Tooltip content={<CustomTooltip />} />
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
