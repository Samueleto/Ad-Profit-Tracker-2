'use client';

interface CountryRow {
  countryCode: string;
  countryName: string;
  flagEmoji?: string;
  revenue: number;
  cost: number;
  netProfit: number;
  share: number;
}

interface GeoBreakdownTableProps {
  rows: CountryRow[];
  isLoading?: boolean;
}

export default function GeoBreakdownTable({ rows, isLoading }: GeoBreakdownTableProps) {
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-4 w-16 bg-gray-100 dark:bg-gray-800 rounded" />
            <div className="h-4 w-16 bg-gray-100 dark:bg-gray-800 rounded" />
            <div className="h-4 w-16 bg-gray-100 dark:bg-gray-800 rounded" />
            <div className="h-4 w-12 bg-gray-100 dark:bg-gray-800 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 py-3">No country data available for this period.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            {['Country', 'Revenue', 'Cost', 'Net Profit', 'Share'].map(h => (
              <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map(r => (
            <tr key={r.countryCode} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                {r.flagEmoji && <span className="mr-1.5">{r.flagEmoji}</span>}
                {r.countryName || r.countryCode}
              </td>
              <td className="px-3 py-2 text-gray-700 dark:text-gray-300">${r.revenue.toFixed(2)}</td>
              <td className="px-3 py-2 text-gray-700 dark:text-gray-300">${r.cost.toFixed(2)}</td>
              <td className={`px-3 py-2 font-medium ${r.netProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                ${r.netProfit.toFixed(2)}
              </td>
              <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{r.share.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
