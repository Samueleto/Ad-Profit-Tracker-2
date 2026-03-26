'use client';

interface CountryRow {
  countryCode: string;
  countryName: string;
  flagEmoji?: string;
  cost: number;
  costShare: number; // 0-100
  impressions: number;
  clicks: number;
  ctr: number;
}

interface ExoClickCountryTableProps {
  rows: CountryRow[];
}

export default function ExoClickCountryTable({ rows }: ExoClickCountryTableProps) {
  if (!rows || rows.length === 0) {
    return (
      <div className="text-center py-10 text-sm text-gray-500 dark:text-gray-400">
        No country data available.
      </div>
    );
  }

  const sorted = [...rows].sort((a, b) => b.cost - a.cost);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            {['Country', 'Cost', 'Cost Share', 'Impressions', 'Clicks', 'CTR'].map(h => (
              <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {sorted.map(row => (
            <tr key={row.countryCode} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <td className="px-3 py-2.5 text-gray-900 dark:text-gray-100">
                {row.flagEmoji && <span className="mr-1.5">{row.flagEmoji}</span>}
                {row.countryName}
              </td>
              <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">${row.cost.toFixed(4)}</td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${Math.min(row.costShare, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">{row.costShare.toFixed(1)}%</span>
                </div>
              </td>
              <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{row.impressions.toLocaleString()}</td>
              <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{row.clicks.toLocaleString()}</td>
              <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{row.ctr.toFixed(2)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
