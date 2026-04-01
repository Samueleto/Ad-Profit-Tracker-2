export default function MemberTableSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          <td className="px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gray-200 dark:bg-gray-700 rounded-full" />
              <div className="space-y-1">
                <div className="h-2.5 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-2 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            </div>
          </td>
          <td className="px-4 py-3"><div className="h-4 w-14 bg-gray-200 dark:bg-gray-700 rounded-full" /></td>
          <td className="px-4 py-3"><div className="h-2.5 w-20 bg-gray-200 dark:bg-gray-700 rounded" /></td>
          <td className="px-4 py-3"><div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded" /></td>
        </tr>
      ))}
    </>
  );
}
