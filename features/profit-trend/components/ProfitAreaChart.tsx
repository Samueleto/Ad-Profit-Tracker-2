'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Line,
  ComposedChart,
  ResponsiveContainer,
} from 'recharts';
import type { ComputedChartData, ChartMetric, DailyProfitDataPoint } from '../types';

interface ProfitAreaChartProps {
  data: ComputedChartData;
  activeMetric: ChartMetric;
  onPointClick?: (point: DailyProfitDataPoint) => void;
}

const COLOR_MAP: Record<string, string> = {
  green: '#22c55e',
  red: '#ef4444',
  amber: '#f59e0b',
};

function getMetricKey(metric: ChartMetric): keyof DailyProfitDataPoint {
  switch (metric) {
    case 'profit': return 'netProfit';
    case 'revenue': return 'revenue';
    case 'cost': return 'cost';
    case 'roi': return 'roi';
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomDot(props: any) {
  const { cx, cy, payload } = props;
  const color = COLOR_MAP[payload.colorCode] ?? '#9ca3af';
  return <circle cx={cx} cy={cy} r={3} fill={color} stroke="white" strokeWidth={1} />;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as DailyProfitDataPoint;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg text-sm">
      <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">{d.date}</p>
      <div className="space-y-1">
        <p>Net Profit: <span className="font-medium">{d.netProfit != null ? `$${d.netProfit.toFixed(2)}` : '—'}</span></p>
        <p>Revenue: <span className="font-medium">{d.revenue != null ? `$${d.revenue.toFixed(2)}` : '—'}</span></p>
        <p>Cost: <span className="font-medium">{d.cost != null ? `$${d.cost.toFixed(2)}` : '—'}</span></p>
        <p>ROI: <span className="font-medium">{d.roi != null ? `${d.roi.toFixed(1)}%` : '—'}</span></p>
      </div>
    </div>
  );
}

export default function ProfitAreaChart({ data, activeMetric, onPointClick }: ProfitAreaChartProps) {
  const metricKey = getMetricKey(activeMetric);
  const fillColor = data.overallProfitable ? '#22c55e' : '#ef4444';
  const fillColorLight = data.overallProfitable ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)';

  const chartData = data.dataPoints.map(p => ({
    ...p,
    movingAvg: data.movingAverage.find(m => m.date === p.date)?.value ?? null,
  }));

  return (
    <div className="h-80 md:h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          onClick={(e: Record<string, unknown>) => {
            const payload = e?.activePayload as Array<{ payload: DailyProfitDataPoint }> | undefined;
            if (payload?.[0] && onPointClick) {
              onPointClick(payload[0].payload);
            }
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,163,175,0.3)" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="4 4" label={{ value: 'Break Even', position: 'right', fontSize: 10, fill: '#9ca3af' }} />

          <Area
            type="monotone"
            dataKey={metricKey as string}
            stroke={fillColor}
            fill={fillColorLight}
            connectNulls={false}
            dot={<CustomDot />}
          />

          <Line
            type="monotone"
            dataKey="movingAvg"
            stroke="#9ca3af"
            strokeDasharray="4 2"
            dot={false}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
