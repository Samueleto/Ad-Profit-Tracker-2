import Link from 'next/link';
import type { HelpArticleListItem } from '../types';

interface PopularArticlesSidebarProps {
  articles: HelpArticleListItem[];
  loading?: boolean;
}

export default function PopularArticlesSidebar({ articles, loading }: PopularArticlesSidebarProps) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">Popular Articles</h3>
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="w-4 h-3 bg-gray-200 dark:bg-gray-700 rounded flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <ol className="space-y-2">
          {articles.slice(0, 5).map((article, idx) => (
            <li key={article.id} className="flex items-start gap-2">
              <span className="text-[11px] font-bold text-gray-300 dark:text-gray-600 w-4 flex-shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <Link
                href={`/help/${article.id}`}
                className="text-xs text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors leading-snug"
              >
                <span className="block">{article.title}</span>
                <span className="text-[11px] text-gray-400">{article.readTimeMinutes} min read</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
