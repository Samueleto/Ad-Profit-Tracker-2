interface ArticleShimmerProps {
  variant: 'list' | 'article' | 'category-grid';
}

export default function ArticleShimmer({ variant }: ArticleShimmerProps) {
  if (variant === 'list') {
    return (
      <div className="space-y-1 animate-pulse">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1 h-3 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded-full flex-shrink-0" />
            <div className="w-10 h-3 bg-gray-200 dark:bg-gray-700 rounded flex-shrink-0" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'article') {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
        <div className="flex gap-3">
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className={`h-3 bg-gray-200 dark:bg-gray-700 rounded ${i % 3 === 2 ? 'w-2/3' : 'w-full'}`} />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
          </div>
        ))}
      </div>
    );
  }

  // category-grid
  return (
    <div className="grid grid-cols-3 gap-3 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-2 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-xl">
          <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16" />
          <div className="h-4 w-6 bg-gray-200 dark:bg-gray-700 rounded-full" />
        </div>
      ))}
    </div>
  );
}
