export default function InvitationTableSkeleton() {
  return (
    <>
      {Array.from({ length: 2 }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          <td className="px-4 py-3"><div className="h-2.5 w-36 bg-gray-200 dark:bg-gray-700 rounded" /></td>
          <td className="px-4 py-3"><div className="h-2.5 w-24 bg-gray-200 dark:bg-gray-700 rounded" /></td>
          <td className="px-4 py-3"><div className="h-2.5 w-16 bg-gray-200 dark:bg-gray-700 rounded" /></td>
          <td className="px-4 py-3"><div className="h-2.5 w-16 bg-gray-200 dark:bg-gray-700 rounded" /></td>
          <td className="px-4 py-3"><div className="h-5 w-12 bg-gray-200 dark:bg-gray-700 rounded" /></td>
        </tr>
      ))}
    </>
  );
}
