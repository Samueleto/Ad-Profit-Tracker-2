'use client';

interface DayRow {
  date: string;
  cost: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
}

interface ExoClickStatsTableProps {
  rows: DayRow[];
}

function fmt(v: number, type: 'currency' | 'number' | 'percent') {
  if (type === 'currency') return `$${v.toFixed(4)}`;
  if (type === 'percent') return `${v.toFixed(2)}%`;
  return v.toLocaleString();
}

export default function ExoClickStatsTable({ rows }: ExoClickStatsTableProps) {
  if (!rows || rows.length === 0) {
    return (
      <div className="text-center py-10 text-sm text-gray-500 dark:text-gray-400">
        No data yet. Run a sync to pull stats from ExoClick.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            {['Date', 'Cost', 'Impressions', 'Clicks', 'CTR', 'CPM'].map(h => (
              <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map(row => (
            <tr key={row.date} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <td className="px-3 py-2.5 text-gray-900 dark:text-gray-100 font-mono text-xs">{row.date}</td>
              <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{fmt(row.cost, 'currency')}</td>
              <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{fmt(row.impressions, 'number')}</td>
              <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{fmt(row.clicks, 'number')}</td>
              <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{fmt(row.ctr, 'percent')}</td>
              <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{fmt(row.cpm, 'currency')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
