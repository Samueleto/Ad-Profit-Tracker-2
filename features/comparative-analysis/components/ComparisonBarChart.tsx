'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import type { NetworkComparisonItem, ComparisonMetric } from '../types';

interface ComparisonBarChartProps {
  networks: NetworkComparisonItem[];
  metric: ComparisonMetric;
  networkLabels: Record<string, string>;
}

const BAR_COLOR: Record<string, string> = {
  exoclick: '#F59E0B',
  rollerads: '#10B981',
  zeydoo: '#10B981',
  propush: '#10B981',
};

const METRIC_KEYS: Record<ComparisonMetric, keyof NetworkComparisonItem> = {
  revenue: 'primaryMetric',
  cost: 'primaryMetric',
  roi: 'primaryMetric',
  impressions: 'impressions',
  clicks: 'clicks',
  ctr: 'averageCtr',
  cpm: 'averageCpm',
};

export default function ComparisonBarChart({ networks, metric, networkLabels }: ComparisonBarChartProps) {
  const key = METRIC_KEYS[metric] ?? 'primaryMetric';
  const data = networks.map(n => ({
    name: networkLabels[n.networkId] ?? n.networkId,
    value: (n[key] as number) ?? 0,
    networkId: n.networkId,
  }));

  const allZero = data.every(d => d.value === 0);

  return (
    <div className="h-[280px] w-full">
      {allZero ? (
        <div className="h-full flex items-center justify-center text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-xl">
          No data for this metric
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,163,175,0.3)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip
              formatter={(v) => {
                const n = typeof v === 'number' ? v : null;
                return n != null ? [n.toLocaleString(), metric.toUpperCase()] : ['—', ''];
              }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map(d => (
                <Cell key={d.networkId} fill={BAR_COLOR[d.networkId] ?? '#6366f1'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
